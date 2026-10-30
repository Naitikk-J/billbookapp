import { Router } from 'express';
import { z } from 'zod';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import { requireAuth, requireCompany } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { buildFlightInvoiceDraft, type FlightInvoiceDraft } from '../utils/flightInvoiceDraft';
import { extractFromFlightPdfBase64 } from '../utils/flightPdfExtract';
import { extractBarcodeSnapshotsFromPdfBuffer } from '../utils/pdfBarcodeSnapshots';
import { saveFlightInvoiceDraft } from '../utils/saveFlightInvoiceDraft';

const router = Router();
router.use(requireAuth, requireCompany);

const parsePdfSchema = z.object({
  fileName: z.string().max(200).optional().default('flight-bill.pdf'),
  mimeType: z.string().max(80).optional().default('application/pdf'),
  base64: z.string().min(64),
});

router.post(
  '/parse-pdf',
  validate(parsePdfSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof parsePdfSchema>;
    const base64 = body.base64.replace(/^data:.*?;base64,/, '');

    const pdfBuffer = Buffer.from(base64, 'base64');
    const [extraction, barcodeSnapshots] = await Promise.all([
      extractFromFlightPdfBase64(base64, body.fileName),
      extractBarcodeSnapshotsFromPdfBuffer(pdfBuffer).catch(() => [] as string[]),
    ]);

    if (extraction.segments.length === 0) {
      throw ApiError.badRequest(
        "Couldn't read flight details from that PDF. Supported: Air India e-ticket, IndiGo itinerary, Safarmate voucher."
      );
    }

    const draft = buildFlightInvoiceDraft(
      extraction.segments,
      extraction.charges,
      [],
      body.fileName
    );

    if (barcodeSnapshots.length > 0) {
      draft.travelDetails = {
        ...draft.travelDetails,
        barcodeSnapshots,
      };
    }

    res.json({
      draft,
      barcodeSnapshots,
      extraction: {
        format: extraction.format,
        rawTextLength: extraction.rawTextLength,
      },
    });
  })
);

const commitDraftSchema = z.object({
  draft: z.record(z.unknown()),
  status: z.enum(['draft', 'sent', 'paid', 'partial', 'overdue', 'cancelled']).optional(),
});

/** Save a flight voucher draft to DB (customer match/create + invoice) in one request. */
router.post(
  '/commit-draft',
  validate(commitDraftSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof commitDraftSchema>;
    const draft = body.draft as unknown as FlightInvoiceDraft;
    if (!draft?.items?.length && !draft?.travelDetails) {
      throw ApiError.badRequest('Invalid flight draft');
    }
    const companyId = req.user!.companyId as string;
    const invoice = await saveFlightInvoiceDraft(companyId, draft, {
      status: body.status ?? 'sent',
    });
    res.status(201).json({ invoice });
  })
);

export default router;
