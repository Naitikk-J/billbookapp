import { Router } from 'express';
import { z } from 'zod';
import { Company } from '../models/Company';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import { requireAuth, requireCompany } from '../middleware/auth';
import { validate } from '../middleware/validate';

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

function sanitize<T extends { toObject?: () => Record<string, unknown> } | Record<string, unknown>>(
  doc: T
): Record<string, unknown> {
  const obj = (typeof (doc as { toObject?: unknown }).toObject === 'function'
    ? (doc as { toObject: () => Record<string, unknown> }).toObject()
    : (doc as Record<string, unknown>)) as Record<string, unknown>;
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
    const company = await Company.findById(req.user!.companyId);
    if (!company) throw ApiError.notFound('Company not found');
    res.json({ company: sanitize(company) });
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
    const company = await Company.findByIdAndUpdate(req.user!.companyId, body, { new: true });
    if (!company) throw ApiError.notFound('Company not found');
    res.json({ company: sanitize(company) });
  })
);

export default router;
