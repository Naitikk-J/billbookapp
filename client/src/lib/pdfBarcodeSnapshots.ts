import { GlobalWorkerOptions, OPS, getDocument, type PDFPageProxy } from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

GlobalWorkerOptions.workerSrc = pdfjsWorker;

const MIN_BARCODE_SCORE = 22;

type PdfImage = {
  width: number;
  height: number;
  data: Uint8ClampedArray | Uint8Array;
};

function sizeAllowsBarcode(width: number, height: number): boolean {
  if (width < 100 || height < 14) return false;
  if (width > 2400 || height > 320) return false;
  const aspect = width / Math.max(height, 1);
  if (aspect < 1.8) return false;
  if (height > 150 && width > 1200) return false;
  if (height >= 32) return aspect >= 2.2;
  return aspect >= 3.5 && width >= 120;
}

function barcodeTransitionScore(rgba: Uint8ClampedArray, width: number, height: number): number {
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
      const lum = rgba[i] * 0.299 + rgba[i + 1] * 0.587 + rgba[i + 2] * 0.114;
      const dark = lum < 145;
      if (x > 0 && dark !== prevDark) transitions++;
      prevDark = dark;
    }
    score += transitions;
  }
  return score / Math.max(1, rowCount);
}

function imageToRgba(img: PdfImage): Uint8ClampedArray | null {
  const { width, height } = img;
  const pixels = img.data;
  const len = width * height;
  if (pixels.length === len * 4) {
    return pixels instanceof Uint8ClampedArray ? pixels : new Uint8ClampedArray(pixels);
  }
  if (pixels.length === len * 3 || pixels.length === len) {
    const rgba = new Uint8ClampedArray(len * 4);
    if (pixels.length === len * 3) {
      for (let i = 0; i < len; i++) {
        rgba[i * 4] = pixels[i * 3];
        rgba[i * 4 + 1] = pixels[i * 3 + 1];
        rgba[i * 4 + 2] = pixels[i * 3 + 2];
        rgba[i * 4 + 3] = 255;
      }
    } else {
      for (let i = 0; i < len; i++) {
        const g = pixels[i];
        rgba[i * 4] = g;
        rgba[i * 4 + 1] = g;
        rgba[i * 4 + 2] = g;
        rgba[i * 4 + 3] = 255;
      }
    }
    return rgba;
  }
  return null;
}

function imageToDataUrl(img: PdfImage): string | null {
  if (typeof document === 'undefined') return null;
  const rgba = imageToRgba(img);
  if (!rgba) return null;
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const idata = ctx.createImageData(img.width, img.height);
  idata.data.set(rgba);
  ctx.putImageData(idata, 0, 0);
  return canvas.toDataURL('image/png');
}

async function imagesFromPage(page: PDFPageProxy): Promise<PdfImage[]> {
  const ops = await page.getOperatorList();
  const out: PdfImage[] = [];
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
    if (fn === OPS.paintInlineImageXObject) {
      const img = ops.argsArray[i][0] as PdfImage;
      if (img?.width) out.push(img);
      continue;
    }
    const key = ops.argsArray[i][0] as string;
    if (seen.has(key)) continue;
    seen.add(key);
    try {
      const img = (await page.objs.get(key)) as PdfImage | null;
      if (img?.width && img?.height && img.data) out.push(img);
    } catch {
      // skip broken xobjects
    }
  }
  return out;
}

/** Pull embedded barcode bitmaps from the uploaded ticket PDF (original airline/agency art). */
export async function extractBarcodeSnapshotsFromPdf(file: File): Promise<string[]> {
  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await getDocument({ data, disableFontFace: true }).promise;
  const scored: Array<{ url: string; score: number; page: number }> = [];
  const urlSeen = new Set<string>();

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const imgs = await imagesFromPage(page);
    for (const img of imgs) {
      if (!sizeAllowsBarcode(img.width, img.height)) continue;
      const rgba = imageToRgba(img);
      if (!rgba) continue;
      const score = barcodeTransitionScore(rgba, img.width, img.height);
      if (score < MIN_BARCODE_SCORE) continue;
      const url = imageToDataUrl(img);
      if (!url || urlSeen.has(url)) continue;
      urlSeen.add(url);
      scored.push({ url, score, page: p });
    }
  }

  await doc.destroy();
  scored.sort((a, b) => a.page - b.page || b.score - a.score);
  return scored.map((s) => s.url).slice(0, 8);
}
