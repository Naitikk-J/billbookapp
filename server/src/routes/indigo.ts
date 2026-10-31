import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler';
import { requireAuth, requireCompany } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { downloadIndigoItinerary } from '../utils/indigoItinerary';

const router = Router();
router.use(requireAuth, requireCompany);

const bodySchema = z.object({
  pnr: z
    .string()
    .trim()
    .min(5)
    .max(8)
    .regex(/^[A-Za-z0-9]+$/, 'PNR should be letters and numbers'),
  lastName: z.string().trim().min(2).max(120),
});

router.post(
  '/itinerary',
  validate(bodySchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof bodySchema>;
    const pnr = body.pnr.toUpperCase();
    const pdf = await downloadIndigoItinerary({
      pnr,
      lastName: body.lastName,
    });
    const filename = `IndiGo-${pnr}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdf);
  })
);

export default router;
