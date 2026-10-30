/** Fields returned for list/dashboard views — avoids shipping line items & flight segments. */
export const INVOICE_LIST_SELECT =
  '_id kind number issueDate dueDate currency template status grandTotal amountPaid balanceDue tags customerSnapshot.name customerSnapshot.email customerSnapshot.phone travelDetails.destination travelDetails.bookingId travelDetails.bookingType';

export function parseInvoiceListLimit(raw: unknown, defaultLimit = 120): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return defaultLimit;
  return Math.min(Math.floor(n), 500);
}

export function parseInvoiceListView(raw: unknown): 'summary' | 'full' {
  const v = String(raw ?? '').trim().toLowerCase();
  return v === 'full' ? 'full' : 'summary';
}
