import { Router } from 'express';
import { z } from 'zod';
import { Product } from '../models/Product';
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

const productSchema = z.object({
  kind: z.enum(['product', 'service']).default('service'),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional().default(''),
  category: z.string().max(120).optional().default(''),
  unit: z.string().max(40).optional().default('pax'),
  price: z.number().min(0),
  taxPercent: z.number().min(0).max(100).optional().default(18),
  hsnCode: z.string().max(40).optional().default(''),
});

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const q = String(req.query.q ?? '').trim();
    const companyId = req.user!.companyId as string;
    const filter: Record<string, unknown> = { ...companyFilter(companyId), isArchived: false };
    if (q) {
      filter.$or = [
        { name: { $regex: q, $options: 'i' } },
        { category: { $regex: q, $options: 'i' } },
      ];
    }
    const key = companyCacheKey(companyId, 'products', querySuffix({ q }));
    await respondCached(res, key, CACHE_TTL.catalogMs, async () => {
      const products = await Product.find(filter).sort({ createdAt: -1 }).limit(500).lean();
      return { products };
    });
  })
);

router.post(
  '/',
  validate(productSchema),
  asyncHandler(async (req, res) => {
    const companyId = req.user!.companyId as string;
    const product = await Product.create({ ...req.body, companyId });
    invalidateCompanyCache(companyId);
    res.status(201).json({ product });
  })
);

router.patch(
  '/:id',
  validate(productSchema.partial()),
  asyncHandler(async (req, res) => {
    const product = await Product.findOneAndUpdate(
      { _id: req.params.id, companyId: req.user!.companyId },
      req.body,
      { new: true }
    );
    if (!product) throw ApiError.notFound('Product not found');
    invalidateCompanyCache(req.user!.companyId as string);
    res.json({ product });
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const product = await Product.findOneAndUpdate(
      { _id: req.params.id, companyId: req.user!.companyId },
      { isArchived: true },
      { new: true }
    );
    if (!product) throw ApiError.notFound('Product not found');
    invalidateCompanyCache(req.user!.companyId as string);
    res.json({ ok: true });
  })
);

export default router;
