export interface LineItemInput {
  description: string;
  hsnCode?: string;
  quantity: number;
  unit?: string;
  rate: number;
  taxPercent?: number;
  discountPercent?: number;
}

export interface LineItemComputed extends Required<Omit<LineItemInput, 'hsnCode' | 'unit'>> {
  hsnCode: string;
  unit: string;
  amount: number;
  taxableValue: number;
  taxAmount: number;
}

export interface InvoiceTotals {
  items: LineItemComputed[];
  subtotal: number;
  discountTotal: number;
  taxableTotal: number;
  taxTotal: number;
  cgstTotal: number;
  sgstTotal: number;
  igstTotal: number;
  grandTotal: number;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function computeTotals(
  items: LineItemInput[],
  taxMode: 'intra' | 'inter' | 'none' = 'intra'
): InvoiceTotals {
  const computed: LineItemComputed[] = items.map((raw) => {
    const quantity = Number(raw.quantity) || 0;
    const rate = Number(raw.rate) || 0;
    const taxPercent = Number(raw.taxPercent ?? 0) || 0;
    const discountPercent = Number(raw.discountPercent ?? 0) || 0;

    const gross = quantity * rate;
    const discount = gross * (discountPercent / 100);
    const taxable = gross - discount;
    const tax = taxMode === 'none' ? 0 : taxable * (taxPercent / 100);
    const amount = taxable + tax;

    return {
      description: raw.description,
      hsnCode: raw.hsnCode ?? '',
      unit: raw.unit ?? 'pax',
      quantity,
      rate,
      taxPercent,
      discountPercent,
      taxableValue: round2(taxable),
      taxAmount: round2(tax),
      amount: round2(amount),
    };
  });

  const subtotal = round2(computed.reduce((sum, it) => sum + it.quantity * it.rate, 0));
  const discountTotal = round2(
    computed.reduce((sum, it) => sum + it.quantity * it.rate * (it.discountPercent / 100), 0)
  );
  const taxableTotal = round2(computed.reduce((sum, it) => sum + it.taxableValue, 0));
  const taxTotal = round2(computed.reduce((sum, it) => sum + it.taxAmount, 0));

  let cgstTotal = 0;
  let sgstTotal = 0;
  let igstTotal = 0;
  if (taxMode === 'intra') {
    cgstTotal = round2(taxTotal / 2);
    sgstTotal = round2(taxTotal - cgstTotal);
  } else if (taxMode === 'inter') {
    igstTotal = taxTotal;
  }

  const grandTotal = round2(taxableTotal + taxTotal);

  return {
    items: computed,
    subtotal,
    discountTotal,
    taxableTotal,
    taxTotal,
    cgstTotal,
    sgstTotal,
    igstTotal,
    grandTotal,
  };
}
