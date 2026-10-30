import { Router } from 'express';
import { z } from 'zod';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import { requireAuth, requireCompany } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { buildFlightInvoiceDraft } from '../utils/flightInvoiceDraft';
import { extractFromFlightPdfBase64 } from '../utils/flightPdfExtract';

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

    const extraction = await extractFromFlightPdfBase64(base64, body.fileName);

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

    res.json({
      draft,
      extraction: {
        format: extraction.format,
        rawTextLength: extraction.rawTextLength,
      },
    });
  })
);

export default router;
