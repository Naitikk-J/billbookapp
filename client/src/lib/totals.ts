export interface LineItem {
  description: string;
  hsnCode?: string;
  quantity: number;
  unit?: string;
  rate: number;
  taxPercent?: number;
  discountPercent?: number;
}

export interface InvoiceTotals {
  subtotal: number;
  discountTotal: number;
  taxableTotal: number;
  taxTotal: number;
  cgstTotal: number;
  sgstTotal: number;
  igstTotal: number;
  grandTotal: number;
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function computeTotals(
  items: LineItem[],
  taxMode: 'intra' | 'inter' | 'none' = 'intra'
): InvoiceTotals {
  let subtotal = 0;
  let discountTotal = 0;
  let taxableTotal = 0;
  let taxTotal = 0;

  for (const it of items) {
    const qty = Number(it.quantity) || 0;
    const rate = Number(it.rate) || 0;
    const taxPct = Number(it.taxPercent ?? 0) || 0;
    const discPct = Number(it.discountPercent ?? 0) || 0;

    const gross = qty * rate;
    const disc = gross * (discPct / 100);
    const taxable = gross - disc;
    const tax = taxMode === 'none' ? 0 : taxable * (taxPct / 100);

    subtotal += gross;
    discountTotal += disc;
    taxableTotal += taxable;
    taxTotal += tax;
  }

  let cgstTotal = 0;
  let sgstTotal = 0;
  let igstTotal = 0;
  if (taxMode === 'intra') {
    cgstTotal = taxTotal / 2;
    sgstTotal = taxTotal - cgstTotal;
  } else if (taxMode === 'inter') {
    igstTotal = taxTotal;
  }

  return {
    subtotal: round2(subtotal),
    discountTotal: round2(discountTotal),
    taxableTotal: round2(taxableTotal),
    taxTotal: round2(taxTotal),
    cgstTotal: round2(cgstTotal),
    sgstTotal: round2(sgstTotal),
    igstTotal: round2(igstTotal),
    grandTotal: round2(taxableTotal + taxTotal),
  };
}
