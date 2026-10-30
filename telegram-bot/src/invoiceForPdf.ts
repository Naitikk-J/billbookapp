import type { Invoice } from '@/lib/types';
import type { ApiInvoice } from './api/safarmate.js';

function mergeBarcodeSnapshots(
  td: Record<string, unknown>,
  fallback?: string[]
): string[] {
  const fromInvoice = Array.isArray(td.barcodeSnapshots)
    ? td.barcodeSnapshots.filter((s): s is string => typeof s === 'string' && s.length > 0)
    : [];
  const fromFallback = fallback?.filter((s) => s.length > 0) ?? [];
  if (fromFallback.length > fromInvoice.length) return fromFallback.slice(0, 8);
  if (fromInvoice.length > 0) return fromInvoice.slice(0, 8);
  return fromFallback.slice(0, 8);
}

/** API/Mongo JSON → shape expected by client PDF templates. */
export function invoiceForPdf(
  raw: ApiInvoice,
  opts?: { barcodeSnapshots?: string[] }
): Invoice {
  const td = (raw.travelDetails ?? {}) as Record<string, unknown>;
  const segments = td.flightSegments ?? (raw as { segments?: unknown }).segments;
  const barcodeSnapshots = mergeBarcodeSnapshots(td, opts?.barcodeSnapshots);
  return {
    ...(raw as unknown as Invoice),
    issueDate:
      typeof raw.issueDate === 'string'
        ? raw.issueDate
        : new Date(String(raw.issueDate ?? Date.now())).toISOString(),
    travelDetails: {
      ...td,
      flightSegments: Array.isArray(segments) ? segments : [],
      barcodeSnapshots,
    },
  };
}
