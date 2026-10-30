import { extractFromFlightPdfBase64 } from '../../server/src/utils/flightPdfExtract.js';
import { buildFlightInvoiceDraft } from '../../server/src/utils/flightInvoiceDraft.js';
import { extractBarcodeSnapshotsFromPdfBuffer } from '../../server/src/utils/pdfBarcodeSnapshots.js';

export async function parseFlightPdfLocal(buffer: Buffer, fileName: string) {
  const base64 = buffer.toString('base64');
  const [extraction, barcodeSnapshots] = await Promise.all([
    extractFromFlightPdfBase64(base64, fileName),
    extractBarcodeSnapshotsFromPdfBuffer(buffer).catch((err) => {
      console.warn('[telegram-bot] barcode extract failed:', err);
      return [] as string[];
    }),
  ]);
  if (extraction.segments.length === 0) {
    throw new Error(
      "Couldn't read flight details from that PDF. Supported: Air India e-ticket, IndiGo itinerary, Safarmate voucher."
    );
  }
  const draft = buildFlightInvoiceDraft(extraction.segments, extraction.charges, [], fileName);
  if (barcodeSnapshots.length > 0) {
    draft.travelDetails = {
      ...draft.travelDetails,
      barcodeSnapshots,
    };
  }
  return {
    draft,
    extraction: { format: extraction.format, barcodeCount: barcodeSnapshots.length },
  };
}
