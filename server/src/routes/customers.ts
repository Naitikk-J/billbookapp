import { Router } from 'express';
import { z } from 'zod';
import { Customer } from '../models/Customer';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import { requireAuth, requireCompany } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  CACHE_TTL,
  companyCacheKey,
  invalidateCompanyCache,
  querySuffix,
  respondCached,
} from '../utils/companyCache';
import { companyFilter } from '../utils/companyScope';

const router = Router();
router.use(requireAuth, requireCompany);

const customerSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email().or(z.literal('')).optional().default(''),
  phone: z.string().max(40).optional().default(''),
  gstNumber: z.string().max(40).optional().default(''),
  panNumber: z.string().max(20).optional().default(''),
  address: z.string().max(500).optional().default(''),
  city: z.string().max(120).optional().default(''),
  state: z.string().max(120).optional().default(''),
  country: z.string().max(120).optional().default('India'),
  postalCode: z.string().max(40).optional().default(''),
  notes: z.string().max(2000).optional().default(''),
  tags: z.array(z.string().max(40)).max(20).optional().default([]),
  kind: z.enum(['customer', 'supplier']).optional().default('customer'),
  openingBalance: z.number().optional().default(0),
});

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const q = String(req.query.q ?? '').trim();
    const kind = req.query.kind ? String(req.query.kind) : undefined;
    const companyId = req.user!.companyId as string;
    const filter: Record<string, unknown> = { ...companyFilter(companyId) };
    if (kind === 'customer' || kind === 'supplier') filter.kind = kind;
    if (q) {
      filter.$or = [
        { name: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } },
        { phone: { $regex: q, $options: 'i' } },
        { city: { $regex: q, $options: 'i' } },
      ];
    }
    const key = companyCacheKey(companyId, 'customers', querySuffix({ q, kind: kind ?? '' }));
    await respondCached(res, key, CACHE_TTL.catalogMs, async () => {
      const customers = await Customer.find(filter).sort({ createdAt: -1 }).limit(500).lean();
      return { customers };
    });
  })
);

router.post(
  '/',
  validate(customerSchema),
  asyncHandler(async (req, res) => {
    const companyId = req.user!.companyId as string;
    const customer = await Customer.create({ ...req.body, companyId });
    invalidateCompanyCache(companyId);
    res.status(201).json({ customer });
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const customer = await Customer.findOne({ _id: req.params.id, companyId: req.user!.companyId });
    if (!customer) throw ApiError.notFound('Customer not found');
    res.json({ customer });
  })
);

router.patch(
  '/:id',
  validate(customerSchema.partial()),
  asyncHandler(async (req, res) => {
    const customer = await Customer.findOneAndUpdate(
      { _id: req.params.id, companyId: req.user!.companyId },
      req.body,
      { new: true }
    );
    if (!customer) throw ApiError.notFound('Customer not found');
    invalidateCompanyCache(req.user!.companyId as string);
    res.json({ customer });
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const result = await Customer.findOneAndDelete({
      _id: req.params.id,
      companyId: req.user!.companyId,
    });
    if (!result) throw ApiError.notFound('Customer not found');
    invalidateCompanyCache(req.user!.companyId as string);
    res.json({ ok: true });
  })
);

export default router;
