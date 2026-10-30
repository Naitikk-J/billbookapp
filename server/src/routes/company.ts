import { Router } from 'express';
import { z } from 'zod';
import { Company } from '../models/Company';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import { requireAuth, requireCompany } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  CACHE_TTL,
  companyCacheKey,
  invalidateCompanyCache,
  respondCached,
} from '../utils/companyCache';

const router = Router();
router.use(requireAuth, requireCompany);

const updateSchema = z
  .object({
    name: z.string().min(2).max(200),
    legalName: z.string().max(200),
    industry: z.string().max(120),
    email: z.string().email().or(z.literal('')),
    phone: z.string().max(40),
    website: z.string().max(200),
    gstNumber: z.string().max(40),
    panNumber: z.string().max(40),
    cinNumber: z.string().max(40),
    contactName: z.string().max(120),
    address: z.string().max(500),
    city: z.string().max(120),
    state: z.string().max(120),
    country: z.string().max(120),
    postalCode: z.string().max(40),
    currency: z.string().max(10),
    logoUrl: z.string().max(500),
    signatureUrl: z.string().max(500),
    stampUrl: z.string().max(500),
    bankName: z.string().max(200),
    beneficiaryName: z.string().max(200),
    accountNumber: z.string().max(60),
    accountType: z.string().max(40),
    bankBranch: z.string().max(200),
    ifsc: z.string().max(40),
    upiId: z.string().max(120),
    paymentQrUrl: z.string().max(1000),
    reminderContactsText: z.string().max(1000),
    reminderDisclaimer: z.string().max(500),
    defaultTerms: z.string().max(2000),
    invoicePrefix: z.string().max(20),
    quotePrefix: z.string().max(20),
    geminiApiKey: z.string().max(200),
    gmailAddress: z.string().email().or(z.literal('')),
    gmailAppPassword: z.string().max(200),
  })
  .partial();

function sanitizeRecord(obj: Record<string, unknown>): Record<string, unknown> {
  const gmail = (obj.gmailAppPassword as string | undefined) ?? '';
  const gemini = (obj.geminiApiKey as string | undefined) ?? '';
  return {
    ...obj,
    gmailAppPassword: gmail ? '••••••••' : '',
    gmailAppPasswordSet: Boolean(gmail),
    geminiApiKey: gemini ? '••••••••' : '',
    geminiApiKeySet: Boolean(gemini),
  };
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const companyId = req.user!.companyId as string;
    const key = companyCacheKey(companyId, 'profile');
    await respondCached(res, key, CACHE_TTL.companyMs, async () => {
      const company = await Company.findById(companyId).lean();
      if (!company) throw ApiError.notFound('Company not found');
      return { company: sanitizeRecord(company as Record<string, unknown>) };
    });
  })
);

router.patch(
  '/',
  validate(updateSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as Record<string, unknown>;
    // ignore masked values coming back from the client
    if (body.gmailAppPassword === '••••••••') delete body.gmailAppPassword;
    if (body.geminiApiKey === '••••••••') delete body.geminiApiKey;
    const companyId = req.user!.companyId as string;
    const company = await Company.findByIdAndUpdate(companyId, body, { new: true }).lean();
    if (!company) throw ApiError.notFound('Company not found');
    invalidateCompanyCache(companyId);
    res.json({ company: sanitizeRecord(company as Record<string, unknown>) });
  })
);

export default router;
