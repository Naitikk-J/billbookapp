import JsBarcode from 'jsbarcode';

export function barcodeDataUrl(
  value: string,
  options?: { height?: number; lineWidth?: number }
): string | null {
  const v = value.trim();
  if (!v || typeof document === 'undefined') return null;
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
    return null;
  }
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
