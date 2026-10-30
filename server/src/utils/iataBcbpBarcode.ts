import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const nodeRequire = createRequire(__filename);

/** IATA Res 792 unique section is 60 characters. Every scanned ticket starts with M. */
const MIN_BCBP_LENGTH = 60;

type Point = { x?: number; y?: number };

type ReadHit = {
  text?: string;
  isValid?: boolean;
  position?: { topLeft?: Point; bottomLeft?: Point };
};

type BarcodeImage = { arrayBuffer: () => Promise<ArrayBuffer> };

type ReaderModule = {
  readBarcodes: (
    input: Uint8Array,
    options?: { formats?: string[]; tryHarder?: boolean }
  ) => Promise<ReadHit[]>;
};

type WriterModule = {
  writeBarcode: (
    input: string,
    options?: {
      format?: string;
      scale?: number;
      options?: string;
      addHRT?: boolean;
      addQuietZones?: boolean;
    }
  ) => Promise<{ image: BarcodeImage | null; error?: string }>;
};

function reader(): ReaderModule {
  return nodeRequire('zxing-wasm/reader') as ReaderModule;
}

function writer(): WriterModule {
  return nodeRequire('zxing-wasm/writer') as WriterModule;
}

async function loadPdfJs() {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const pkgRoot = dirname(nodeRequire.resolve('pdfjs-dist/package.json'));
  pdfjs.GlobalWorkerOptions.workerSrc = join(pkgRoot, 'build', 'pdf.worker.min.mjs');
  return pdfjs;
}

function hitY(hit: ReadHit): number {
  const top = hit.position?.topLeft?.y;
  const bottom = hit.position?.bottomLeft?.y;
  if (typeof top === 'number' && typeof bottom === 'number') return Math.min(top, bottom);
  return typeof top === 'number' ? top : 0;
}

function isBcbp(text: string): boolean {
  return text.startsWith('M') && text.length >= MIN_BCBP_LENGTH;
}

/** Fresh PDF417 of the exact boarding-pass string (trailing spaces included). */
async function pdf417DataUrl(text: string): Promise<string | null> {
  const res = await writer().writeBarcode(text, {
    format: 'PDF417',
    scale: 2,
    options: 'columns=8',
    addHRT: false,
    addQuietZones: true,
  });
  if (!res.image || res.error) return null;
  const buf = Buffer.from(await res.image.arrayBuffer());
  if (buf.length < 80) return null;
  return `data:image/png;base64,${buf.toString('base64')}`;
}

/**
 * Decode each ticket PDF417 and return a newly drawn barcode of that same payload.
 * Air India and IndiGo both use IATA BCBP (`M` + one leg). The tail differs by airline,
 * so the original string is copied rather than rebuilt from parsed fields.
 */
export async function generatedIataBarcodeSnapshots(buffer: Buffer): Promise<string[]> {
  const { createCanvas } = await import('@napi-rs/canvas');
  const pdfjs = await loadPdfJs();
  const pkgRoot = dirname(nodeRequire.resolve('pdfjs-dist/package.json'));
  const doc = await pdfjs
    .getDocument({
      data: new Uint8Array(buffer),
      disableFontFace: true,
      useSystemFonts: true,
      standardFontDataUrl: join(pkgRoot, 'standard_fonts/'),
    })
    .promise;

  const found: Array<{ text: string; page: number; y: number }> = [];
  try {
    const pageCount = Math.min(doc.numPages, 15);
    for (let p = 1; p <= pageCount; p++) {
      const page = await doc.getPage(p);
      const viewport = page.getViewport({ scale: 3 });
      const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport } as never).promise;
      const png = canvas.toBuffer('image/png');
      const hits = await reader().readBarcodes(png, { formats: ['PDF417'], tryHarder: true });
      for (const hit of hits) {
        const text = hit.text ?? '';
        if (!isBcbp(text) || hit.isValid === false) continue;
        found.push({ text, page: p, y: hitY(hit) });
      }
    }
  } finally {
    await doc.destroy();
  }

  found.sort((a, b) => a.page - b.page || a.y - b.y);
  const payloads: string[] = [];
  const seen = new Set<string>();
  for (const hit of found) {
    if (seen.has(hit.text)) continue;
    seen.add(hit.text);
    payloads.push(hit.text);
    if (payloads.length >= 8) break;
  }

  const urls: string[] = [];
  for (const text of payloads) {
    const url = await pdf417DataUrl(text);
    if (url) urls.push(url);
  }
  return urls;
}
