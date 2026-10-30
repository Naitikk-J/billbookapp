import { GlobalWorkerOptions, OPS, getDocument, type PDFPageProxy } from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

GlobalWorkerOptions.workerSrc = pdfjsWorker;

type PdfImage = {
  width: number;
  height: number;
  data: Uint8ClampedArray | Uint8Array;
};

function looksLikeBarcode(width: number, height: number): boolean {
  if (width < 200 || height < 35) return false;
  if (width / Math.max(height, 1) < 2.4) return false;
  if (width > 2200 || height > 280) return false;
  return true;
}

function imageToDataUrl(img: PdfImage): string | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const pixels = img.data;
  const len = img.width * img.height;
  if (pixels.length === len * 4) {
    const idata = ctx.createImageData(img.width, img.height);
    idata.data.set(pixels);
    ctx.putImageData(idata, 0, 0);
  } else if (pixels.length === len * 3) {
    const idata = ctx.createImageData(img.width, img.height);
    for (let i = 0; i < len; i++) {
      idata.data[i * 4] = pixels[i * 3];
      idata.data[i * 4 + 1] = pixels[i * 3 + 1];
      idata.data[i * 4 + 2] = pixels[i * 3 + 2];
      idata.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(idata, 0, 0);
  } else if (pixels.length === len) {
    const idata = ctx.createImageData(img.width, img.height);
    for (let i = 0; i < len; i++) {
      const g = pixels[i];
      idata.data[i * 4] = g;
      idata.data[i * 4 + 1] = g;
      idata.data[i * 4 + 2] = g;
      idata.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(idata, 0, 0);
  } else {
    return null;
  }

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
      fn !== OPS.paintImageXObjectRepeat
    ) {
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
  const urls: string[] = [];
  const urlSeen = new Set<string>();

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const imgs = await imagesFromPage(page);
    for (const img of imgs) {
      if (!looksLikeBarcode(img.width, img.height)) continue;
      const url = imageToDataUrl(img);
      if (!url || urlSeen.has(url)) continue;
      urlSeen.add(url);
      urls.push(url);
    }
  }

  await doc.destroy();
  return urls;
}
