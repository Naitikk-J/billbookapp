import type { Invoice } from '@/lib/types';
import type { ApiInvoice } from './api/safarmate.js';

/** API/Mongo JSON → shape expected by client PDF templates. */
export function invoiceForPdf(raw: ApiInvoice): Invoice {
  const td = (raw.travelDetails ?? {}) as Record<string, unknown>;
  const segments = td.flightSegments ?? (raw as { segments?: unknown }).segments;
  return {
    ...(raw as unknown as Invoice),
    issueDate:
      typeof raw.issueDate === 'string'
        ? raw.issueDate
        : new Date(String(raw.issueDate ?? Date.now())).toISOString(),
    travelDetails: {
      ...td,
      flightSegments: Array.isArray(segments) ? segments : [],
    },
  };
}
