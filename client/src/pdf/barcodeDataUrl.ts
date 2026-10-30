import JsBarcode from 'jsbarcode';

/** CODE128-B module patterns (value 0–106). Stop is index 106. */
const CODE128 = [
  '212222','222122','222221','121223','121322','131222','122213','122312','132212','221213',
  '221312','231212','112232','122132','122231','113222','123122','123221','223211','221132',
  '221231','213212','223112','312131','311222','321122','321221','312212','322112','322211',
  '212123','212321','232121','111323','131123','131321','112313','132113','132311','211313',
  '231113','231311','112133','112331','132131','113123','113321','133121','313121','211331',
  '231131','213113','213311','213131','311123','311321','331121','312113','312311','332111',
  '314111','221411','431111','111224','111422','121124','121421','141122','141221','112214',
  '112412','122114','122411','142112','142211','241211','221114','413111','241112','134111',
  '111242','121142','121241','114212','124112','124211','411212','421112','421211','212141',
  '214121','412121','111143','111341','131141','114113','114311','411113','411311','113141',
  '114131','311141','411131','211412','211214','211232','2331112',
];

function code128Modules(text: string): number[] {
  const values: number[] = [104];
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    if (code < 32 || code > 126) continue;
    values.push(code - 32);
  }
  let sum = values[0]!;
  for (let i = 1; i < values.length; i++) sum += values[i]! * i;
  values.push(sum % 103);
  values.push(106);
  const modules: number[] = [];
  for (const v of values) {
    const pat = CODE128[v];
    if (!pat) continue;
    let bar = true;
    for (const digit of pat) {
      const n = Number(digit);
      for (let i = 0; i < n; i++) modules.push(bar ? 1 : 0);
      bar = !bar;
    }
  }
  return modules;
}

function crc32(buf: Uint8Array): number {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i]!;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  out.set([type.charCodeAt(0), type.charCodeAt(1), type.charCodeAt(2), type.charCodeAt(3)], 4);
  out.set(data, 8);
  const crcSrc = out.subarray(4, 8 + data.length);
  view.setUint32(8 + data.length, crc32(crcSrc));
  return out;
}

function rgbaToPngDataUrl(rgba: Uint8Array, width: number, height: number): string | null {
  let zlib: { deflateSync: (b: Uint8Array) => Uint8Array } | null = null;
  try {
    const req = Function('return typeof require !== "undefined" ? require : null')() as
      | ((id: string) => { deflateSync: (b: Uint8Array) => Uint8Array })
      | null;
    zlib = req ? req('node:zlib') : null;
  } catch {
    zlib = null;
  }
  if (!zlib) return null;
  const raw = new Uint8Array((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    const row = y * (width * 4 + 1);
    raw[row] = 0;
    raw.set(rgba.subarray(y * width * 4, (y + 1) * width * 4), row + 1);
  }
  const compressed = zlib.deflateSync(raw);
  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, width);
  dv.setUint32(4, height);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const sig = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const chunks = [pngChunk('IHDR', ihdr), pngChunk('IDAT', compressed), pngChunk('IEND', new Uint8Array())];
  const total = sig.length + chunks.reduce((n, c) => n + c.length, 0);
  const png = new Uint8Array(total);
  png.set(sig, 0);
  let off = sig.length;
  for (const c of chunks) {
    png.set(c, off);
    off += c.length;
  }
  const b64 =
    typeof Buffer !== 'undefined'
      ? Buffer.from(png).toString('base64')
      : btoa(String.fromCharCode(...png));
  return `data:image/png;base64,${b64}`;
}

function nodeBarcodeDataUrl(
  value: string,
  options?: { height?: number; lineWidth?: number }
): string | null {
  const modules = code128Modules(value);
  if (modules.length < 20) return null;
  const scale = Math.max(1, Math.round(options?.lineWidth ?? 2));
  const barH = options?.height ?? 36;
  const quiet = 8;
  const width = modules.length * scale + quiet * 2;
  const height = barH + 8;
  const rgba = new Uint8Array(width * height * 4);
  rgba.fill(255);
  for (let y = 4; y < 4 + barH; y++) {
    for (let i = 0; i < modules.length; i++) {
      if (!modules[i]) continue;
      for (let s = 0; s < scale; s++) {
        const x = quiet + i * scale + s;
        const p = (y * width + x) * 4;
        rgba[p] = 0;
        rgba[p + 1] = 0;
        rgba[p + 2] = 0;
        rgba[p + 3] = 255;
      }
    }
  }
  return rgbaToPngDataUrl(rgba, width, height);
}

export function barcodeDataUrl(
  value: string,
  options?: { height?: number; lineWidth?: number }
): string | null {
  const v = value.trim();
  if (!v) return null;
  if (typeof document !== 'undefined') {
    try {
      const canvas = document.createElement('canvas');
      JsBarcode(canvas, v, {
        format: 'CODE128',
        displayValue: false,
        margin: 4,
        height: options?.height ?? 36,
        width: options?.lineWidth ?? 1.1,
      });
      return canvas.toDataURL('image/png');
    } catch {
      return nodeBarcodeDataUrl(v, options);
    }
  }
  return nodeBarcodeDataUrl(v, options);
}

/** Payload encoded on sector barcodes (PNR + route). */
export function sectorBarcodeValue(pnr: string, fromAirport: string, toAirport: string): string {
  const p = pnr.trim().toUpperCase();
  const from = fromAirport.trim().toUpperCase();
  const to = toAirport.trim().toUpperCase();
  if (p && from && to) return `${p}/${from}-${to}`;
  if (from && to) return `${from}-${to}`;
  return p || 'BOOKING';
}
