import { Router } from 'express';
import { z } from 'zod';
import { Customer } from '../models/Customer';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import { requireAuth, requireCompany } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { extractFlights } from '../utils/flightAi';
import { extractFlightBillCharges } from '../utils/flightBillInvoiceAi';
import { buildFlightInvoiceDraft } from '../utils/flightInvoiceDraft';
import { resolveGeminiApiKey } from '../utils/geminiKey';

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
    const companyId = req.user!.companyId as string;
    const apiKey = await resolveGeminiApiKey(companyId);
    const body = req.body as z.infer<typeof parsePdfSchema>;
    const base64 = body.base64.replace(/^data:.*?;base64,/, '');
    const pdf = { base64, mimeType: body.mimeType || 'application/pdf' };

    const [segments, charges, customers] = await Promise.all([
      extractFlights({ apiKey, pdf }),
      extractFlightBillCharges({ apiKey, pdf }),
      Customer.find({ companyId }).select('name phone email city').sort({ name: 1 }).lean(),
    ]);

    if (segments.length === 0) {
      throw ApiError.badRequest("Couldn't find flight details in that PDF. Try a clearer ticket or tax invoice PDF.");
    }

    const draft = buildFlightInvoiceDraft(
      segments,
      charges,
      customers as Array<{ _id: unknown; name: string; phone?: string; email?: string; city?: string }>,
      body.fileName
    );

    res.json({ draft });
  })
);

export default router;
