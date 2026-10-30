import { createRequire } from 'node:module';
import { join, dirname } from 'node:path';
import { PNG } from 'pngjs';

const nodeRequire = createRequire(__filename);

const MIN_BARCODE_SCORE = 22;
const MIN_RENDER_SCORE = 18;

type PdfImage = {
  width: number;
  height: number;
  data: Uint8ClampedArray | Uint8Array;
};

type ScoredUrl = {
  url: string;
  score: number;
  page: number;
  kind: 'embedded' | 'render';
  width: number;
  height: number;
};

function imageToRgba(img: PdfImage): Buffer | null {
  const { width, height } = img;
  const pixels = img.data;
  const len = width * height;
  const rgba = Buffer.alloc(len * 4);

  if (pixels.length === len * 4) {
    for (let i = 0; i < len * 4; i++) rgba[i] = pixels[i]!;
  } else if (pixels.length === len * 3) {
    for (let i = 0; i < len; i++) {
      rgba[i * 4] = pixels[i * 3]!;
      rgba[i * 4 + 1] = pixels[i * 3 + 1]!;
      rgba[i * 4 + 2] = pixels[i * 3 + 2]!;
      rgba[i * 4 + 3] = 255;
    }
  } else if (pixels.length === len) {
    for (let i = 0; i < len; i++) {
      const g = pixels[i]!;
      rgba[i * 4] = g;
      rgba[i * 4 + 1] = g;
      rgba[i * 4 + 2] = g;
      rgba[i * 4 + 3] = 255;
    }
  } else {
    return null;
  }
  return rgba;
}

/** Higher = more vertical bar transitions (PDF417 / 1D barcode-like). */
export function barcodeTransitionScore(rgba: Buffer, width: number, height: number): number {
  if (width < 8 || height < 4) return 0;
  let score = 0;
  const rowStep = Math.max(1, Math.floor(height / 24));
  let rowCount = 0;
  for (let y = 0; y < height; y += rowStep) {
    rowCount++;
    let transitions = 0;
    let prevDark = false;
    const xStep = Math.max(1, Math.floor(width / 400));
    for (let x = 0; x < width; x += xStep) {
      const i = (y * width + x) * 4;
      if (i + 2 >= rgba.length) break;
      const lum = rgba[i]! * 0.299 + rgba[i + 1]! * 0.587 + rgba[i + 2]! * 0.114;
      const dark = lum < 145;
      if (x > 0 && dark !== prevDark) transitions++;
      prevDark = dark;
    }
    score += transitions;
  }
  return score / Math.max(1, rowCount);
}

function sizeAllowsBarcode(width: number, height: number): boolean {
  if (width < 100 || height < 14) return false;
  if (width > 2400 || height > 320) return false;
  const aspect = width / Math.max(height, 1);
  if (aspect < 1.8) return false;
  if (height > 150 && width > 1200) return false;
  if (height >= 32) return aspect >= 2.2;
  return aspect >= 3.5 && width >= 120;
}

function rgbaToPngDataUrl(rgba: Buffer, width: number, height: number): string {
  const pngImage = new PNG({ width, height });
  rgba.copy(pngImage.data);
  const png = PNG.sync.write(pngImage);
  return `data:image/png;base64,${png.toString('base64')}`;
}

function imageToPngDataUrl(img: PdfImage): string | null {
  const rgba = imageToRgba(img);
  if (!rgba) return null;
  return rgbaToPngDataUrl(rgba, img.width, img.height);
}

function canvasToPngDataUrl(canvas: { toBuffer: (mime: 'image/png') => Buffer }): string {
  const png = canvas.toBuffer('image/png');
  return `data:image/png;base64,${png.toString('base64')}`;
}

function barcodeBandScore(data: Uint8ClampedArray, width: number, y: number, bandHeight: number): number {
  let score = 0;
  const yEnd = Math.min(y + bandHeight, Math.floor(data.length / (width * 4)));
  for (let row = y; row < yEnd; row++) {
    let transitions = 0;
    let prevDark = false;
    const xStep = Math.max(1, Math.floor(width / 400));
    for (let x = 0; x < width; x += xStep) {
      const i = (row * width + x) * 4;
      const lum = data[i]! * 0.299 + data[i + 1]! * 0.587 + data[i + 2]! * 0.114;
      const dark = lum < 145;
      if (x > 0 && dark !== prevDark) transitions++;
      prevDark = dark;
    }
    score += transitions;
  }
  return score / Math.max(1, yEnd - y);
}

async function loadPdfJs(): Promise<{
  getDocument: typeof import('pdfjs-dist/legacy/build/pdf.mjs').getDocument;
  OPS: typeof import('pdfjs-dist/legacy/build/pdf.mjs').OPS;
}> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const pkgRoot = dirname(nodeRequire.resolve('pdfjs-dist/package.json'));
  pdfjs.GlobalWorkerOptions.workerSrc = join(pkgRoot, 'build', 'pdf.worker.min.mjs');
  return pdfjs;
}

function pdfDocumentOptions(data: Uint8Array) {
  const pkgRoot = dirname(nodeRequire.resolve('pdfjs-dist/package.json'));
  return {
    data,
    disableFontFace: true,
    useSystemFonts: true,
    standardFontDataUrl: join(pkgRoot, 'standard_fonts/'),
  };
}

async function extractEmbeddedScored(
  doc: { numPages: number; getPage: (n: number) => Promise<import('pdfjs-dist').PDFPageProxy> },
  OPS: Awaited<ReturnType<typeof loadPdfJs>>['OPS']
): Promise<ScoredUrl[]> {
  const out: ScoredUrl[] = [];
  const urlSeen = new Set<string>();

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const ops = await page.getOperatorList();
    const seen = new Set<string>();

    for (let i = 0; i < ops.fnArray.length; i++) {
      const fn = ops.fnArray[i];
      if (
        fn !== OPS.paintImageXObject &&
        fn !== OPS.paintXObject &&
        fn !== OPS.paintImageXObjectRepeat &&
        fn !== OPS.paintInlineImageXObject
      ) {
        continue;
      }

      let img: PdfImage | null = null;
      if (fn === OPS.paintInlineImageXObject) {
        img = ops.argsArray[i]![0] as PdfImage;
      } else {
        const key = ops.argsArray[i]![0] as string;
        if (seen.has(key)) continue;
        seen.add(key);
        try {
          img = (await page.objs.get(key)) as PdfImage | null;
        } catch {
          continue;
        }
      }

      if (!img?.width || !img?.height || !img.data) continue;
      if (!sizeAllowsBarcode(img.width, img.height)) continue;
      const rgba = imageToRgba(img);
      if (!rgba) continue;
      const score = barcodeTransitionScore(rgba, img.width, img.height);
      const strip =
        img.height <= 40 && img.width >= 100 && img.width / img.height >= 4;
      if (score < (strip ? 8 : MIN_BARCODE_SCORE)) continue;
      const url = rgbaToPngDataUrl(rgba, img.width, img.height);
      if (urlSeen.has(url)) continue;
      urlSeen.add(url);
      out.push({ url, score, page: p, kind: 'embedded', width: img.width, height: img.height });
    }
  }

  return out;
}

async function extractRenderedScored(buffer: Buffer): Promise<ScoredUrl[]> {
  const { createCanvas } = await import('@napi-rs/canvas');
  const { getDocument } = await loadPdfJs();
  const data = new Uint8Array(buffer);
  const doc = await getDocument(pdfDocumentOptions(data)).promise;
  const out: ScoredUrl[] = [];
  const scale = 2.5;

  try {
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const viewport = page.getViewport({ scale });
      const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      const ctx = canvas.getContext('2d');
      await page.render({
        canvasContext: ctx,
        viewport,
      } as never).promise;

      const full = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const bands: Array<{ y: number; score: number; h: number }> = [];

      for (const bandHeight of [Math.floor(36 * scale), Math.floor(52 * scale), Math.floor(28 * scale)]) {
        for (let y = 0; y <= canvas.height - bandHeight; y += Math.floor(6 * scale)) {
          const score = barcodeBandScore(full.data, canvas.width, y, bandHeight);
          if (score >= MIN_RENDER_SCORE) {
            bands.push({ y, score, h: bandHeight });
          }
        }
      }

      bands.sort((a, b) => b.score - a.score);
      const picked: typeof bands = [];
      for (const b of bands) {
        if (picked.some((x) => Math.abs(x.y - b.y) < Math.floor(20 * scale))) continue;
        picked.push(b);
        if (picked.length >= 1) break;
      }

      for (const band of picked) {
        const padX = Math.floor(canvas.width * 0.06);
        const cropW = canvas.width - padX * 2;
        const cropCanvas = createCanvas(cropW, band.h);
        const cropCtx = cropCanvas.getContext('2d');
        cropCtx.drawImage(canvas, padX, band.y, cropW, band.h, 0, 0, cropW, band.h);
        const url = canvasToPngDataUrl(cropCanvas);
        out.push({
          url,
          score: band.score,
          page: p,
          kind: 'render',
          width: cropW,
          height: band.h,
        });
      }
    }
  } finally {
    await doc.destroy();
  }

  return out;
}

/** Air India / IndiGo ticket barcodes are short, wide strips — not page banners. */
function isStripBarcode(c: ScoredUrl): boolean {
  if (c.height < 14 || c.height > 40) return false;
  if (c.width < 100 || c.width > 900) return false;
  return c.width / c.height >= 4;
}

function mergeScoredCandidates(embedded: ScoredUrl[], rendered: ScoredUrl[]): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();

  const strips = embedded.filter(isStripBarcode);
  const pool = strips.length > 0 ? strips : embedded;
  for (const c of pool) {
    if (seen.has(c.url) || c.url.length < 400) continue;
    seen.add(c.url);
    urls.push(c.url);
    if (urls.length >= 8) return urls;
  }

  if (urls.length > 0) return urls;

  const renByPage = new Map<number, ScoredUrl[]>();
  for (const c of rendered) {
    const list = renByPage.get(c.page) ?? [];
    list.push(c);
    renByPage.set(c.page, list);
  }

  const renPages = [...renByPage.keys()].sort((a, b) => a - b);
  for (const page of renPages) {
    const list = (renByPage.get(page) ?? []).sort((a, b) => b.score - a.score);
    const best = list[0];
    if (!best || seen.has(best.url) || best.url.length < 400) continue;
    seen.add(best.url);
    urls.push(best.url);
    if (urls.length >= 8) break;
  }

  return urls;
}

/** Pull barcode images from ticket PDF (embedded bitmaps + rendered strips, content-scored). */
export async function extractBarcodeSnapshotsFromPdfBuffer(buffer: Buffer): Promise<string[]> {
  const { getDocument, OPS } = await loadPdfJs();
  const data = new Uint8Array(buffer);
  const doc = await getDocument(pdfDocumentOptions(data)).promise;

  let embedded: ScoredUrl[] = [];
  try {
    embedded = await extractEmbeddedScored(doc, OPS);
  } finally {
    await doc.destroy();
  }

  const rendered = await extractRenderedScored(buffer);
  return mergeScoredCandidates(embedded, rendered);
}
