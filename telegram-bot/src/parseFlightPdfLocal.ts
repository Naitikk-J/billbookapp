import { extractFromFlightPdfBase64 } from '../../server/src/utils/flightPdfExtract.js';
import { buildFlightInvoiceDraft } from '../../server/src/utils/flightInvoiceDraft.js';

export async function parseFlightPdfLocal(buffer: Buffer, fileName: string) {
  const base64 = buffer.toString('base64');
  const extraction = await extractFromFlightPdfBase64(base64, fileName);
  if (extraction.segments.length === 0) {
    throw new Error(
      "Couldn't read flight details from that PDF. Supported: Air India e-ticket, IndiGo itinerary, Safarmate voucher."
    );
  }
  const draft = buildFlightInvoiceDraft(extraction.segments, extraction.charges, [], fileName);
  return { draft, extraction: { format: extraction.format } };
}
