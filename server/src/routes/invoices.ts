import { Router } from 'express';
import { z } from 'zod';
import { Invoice } from '../models/Invoice';
import { Customer } from '../models/Customer';
import { Company } from '../models/Company';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import { requireAuth, requireCompany } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { computeTotals } from '../utils/totals';
import { INVOICE_TEMPLATES, normalizeTemplateId, type InvoiceTemplateId } from '../config/invoiceTemplates';
import { normalizeTravelDetails, validateTravelForTemplate } from '../utils/invoiceTravel';
import {
  CACHE_TTL,
  companyCacheKey,
  invalidateCompanyCache,
  querySuffix,
  respondCached,
} from '../utils/companyCache';
import { companyFilter, toCompanyObjectId } from '../utils/companyScope';

const router = Router();
router.use(requireAuth, requireCompany);

const lineItemSchema = z.object({
  description: z.string().min(1).max(500),
  hsnCode: z.string().max(200).optional().default(''),
  quantity: z.number().min(0),
  unit: z.string().max(40).optional().default('pax'),
  rate: z.number().min(0),
  taxPercent: z.number().min(0).max(100).optional().default(0),
  discountPercent: z.number().min(0).max(100).optional().default(0),
});

const travelSchema = z
  .object({
    bookingType: z.enum(['hotel', 'flight']).optional(),
    packageName: z.string().max(200).optional().default(''),
    destination: z.string().max(200).optional().default(''),
    startDate: z.string().datetime().optional().or(z.literal('')),
    endDate: z.string().datetime().optional().or(z.literal('')),
    adults: z.number().int().min(0).optional().default(0),
    children: z.number().int().min(0).optional().default(0),
    hotel: z.string().max(500).optional().default(''),
    flight: z.string().max(500).optional().default(''),
    vehicle: z.string().max(500).optional().default(''),
    notes: z.string().max(2000).optional().default(''),
    bookingId: z.string().max(120).optional().default(''),
    hotelCity: z.string().max(200).optional().default(''),
    travellerName: z.string().max(200).optional().default(''),
    travellerPan: z.string().max(20).optional().default(''),
    panHolderName: z.string().max(200).optional().default(''),
    advancedReceiptVoucherNo: z.string().max(120).optional().default(''),
    placeOfSupply: z.string().max(120).optional().default(''),
    transactionalCategory: z.string().max(40).optional().default(''),
    transactionalDetails: z.string().max(40).optional().default(''),
    serviceDescription: z.string().max(500).optional().default(''),
  })
  .partial()
  .optional();

const invoiceSchema = z.object({
  kind: z.enum(['invoice', 'quote', 'proforma', 'receipt']).default('invoice'),
  customerId: z.string().min(1),
  number: z.string().max(80).optional(),
  issueDate: z.string().datetime().optional(),
  dueDate: z.string().datetime().optional().or(z.literal('')),
  currency: z.string().max(10).optional().default('INR'),
  template: z.string().max(40).optional().default('modern'),
  items: z.array(lineItemSchema).min(1),
  travelDetails: travelSchema,
  notes: z.string().max(4000).optional().default(''),
  terms: z.string().max(4000).optional().default(''),
  taxMode: z.enum(['intra', 'inter', 'none']).optional().default('intra'),
  status: z.enum(['draft', 'sent', 'paid', 'partial', 'overdue', 'cancelled']).optional(),
  tags: z.array(z.string().max(40)).max(20).optional().default([]),
});

function resolveTemplateId(raw?: string): InvoiceTemplateId {
  const id = normalizeTemplateId(raw ?? 'modern');
  if (!id) throw ApiError.badRequest(`Unknown invoice template: ${raw ?? ''}`);
  return id;
}

function customerTravelContext(customer: {
  name: string;
  state?: string;
  gstNumber?: string;
  panNumber?: string;
}) {
  return {
    name: customer.name,
    state: customer.state,
    gstNumber: customer.gstNumber,
    panNumber: customer.panNumber,
  };
}

function prepareTravel(
  templateId: InvoiceTemplateId,
  travelInput: z.infer<typeof travelSchema> | undefined,
  customer: { name: string; state?: string; gstNumber?: string; panNumber?: string }
) {
  const travelDetails = normalizeTravelDetails(templateId, travelInput ?? {}, customerTravelContext(customer));
  const travelError = validateTravelForTemplate(templateId, travelDetails);
  if (travelError) throw ApiError.badRequest(travelError);
  return travelDetails;
}

async function nextNumber(
  companyId: string,
  kind: 'invoice' | 'quote' | 'proforma' | 'receipt'
): Promise<string> {
  const company = await Company.findById(companyId);
  if (!company) throw ApiError.notFound('Company not found');

  const prefix = kind === 'quote' ? company.quotePrefix : company.invoicePrefix;
  const field = kind === 'quote' ? 'nextQuoteNumber' : 'nextInvoiceNumber';

  const updated = await Company.findByIdAndUpdate(
    companyId,
    { $inc: { [field]: 1 } },
    { new: true }
  );
  const counter = (updated?.get(field) as number) ?? 1;
  const padded = String(counter - 1).padStart(5, '0');
  return `${prefix}${padded}`;
}

router.get(
  '/templates',
  asyncHandler(async (_req, res) => {
    await respondCached(res, 'global:invoice-templates', CACHE_TTL.templatesMs, async () => ({
      templates: INVOICE_TEMPLATES,
    }));
  })
);

router.get(
  '/stats',
  asyncHandler(async (req, res) => {
    const companyId = req.user!.companyId as string;
    const key = companyCacheKey(companyId, 'invoices', 'stats');
    await respondCached(res, key, CACHE_TTL.invoiceStatsMs, async () => {
      const cid = toCompanyObjectId(companyId);
      const now = new Date();
      const startOfDay = new Date(now);
      startOfDay.setHours(0, 0, 0, 0);
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

      const [todayAgg, monthAgg, pendingAgg, paidAgg, statusAgg, monthly] = await Promise.all([
        Invoice.aggregate([
          { $match: { companyId: cid, issueDate: { $gte: startOfDay } } },
          { $group: { _id: null, total: { $sum: '$amountPaid' } } },
        ]),
        Invoice.aggregate([
          { $match: { companyId: cid, issueDate: { $gte: startOfMonth } } },
          { $group: { _id: null, total: { $sum: '$amountPaid' }, count: { $sum: 1 } } },
        ]),
        Invoice.aggregate([
          {
            $match: {
              companyId: cid,
              status: { $in: ['sent', 'partial', 'overdue'] },
            },
          },
          { $group: { _id: null, total: { $sum: '$balanceDue' }, count: { $sum: 1 } } },
        ]),
        Invoice.countDocuments({ ...companyFilter(companyId), status: 'paid' }),
        Invoice.aggregate([
          { $match: { companyId: cid } },
          { $group: { _id: '$status', count: { $sum: 1 } } },
        ]),
        Invoice.aggregate([
          {
            $match: {
              companyId: cid,
              issueDate: { $gte: sixMonthsAgo },
            },
          },
          {
            $group: {
              _id: { y: { $year: '$issueDate' }, m: { $month: '$issueDate' } },
              revenue: { $sum: '$grandTotal' },
              received: { $sum: '$amountPaid' },
            },
          },
          { $sort: { '_id.y': 1, '_id.m': 1 } },
        ]),
      ]);

      return {
        today: { revenue: todayAgg[0]?.total ?? 0 },
        month: { revenue: monthAgg[0]?.total ?? 0, count: monthAgg[0]?.count ?? 0 },
        pending: { total: pendingAgg[0]?.total ?? 0, count: pendingAgg[0]?.count ?? 0 },
        paidCount: paidAgg,
        byStatus: Object.fromEntries(statusAgg.map((s) => [s._id, s.count])),
        monthly: monthly.map((m) => ({
          year: m._id.y,
          month: m._id.m,
          revenue: m.revenue,
          received: m.received,
        })),
      };
    });
  })
);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const q = String(req.query.q ?? '').trim();
    const status = String(req.query.status ?? '').trim();
    const kind = String(req.query.kind ?? '').trim();
    const companyId = req.user!.companyId as string;
    const filter: Record<string, unknown> = { ...companyFilter(companyId) };
    if (status) filter.status = status;
    if (kind) filter.kind = kind;
    if (q) {
      filter.$or = [
        { number: { $regex: q, $options: 'i' } },
        { 'customerSnapshot.name': { $regex: q, $options: 'i' } },
        { 'travelDetails.destination': { $regex: q, $options: 'i' } },
      ];
    }
    const key = companyCacheKey(
      companyId,
      'invoices',
      'list',
      querySuffix({ q, status, kind })
    );
    await respondCached(res, key, CACHE_TTL.invoicesListMs, async () => {
      const invoices = await Invoice.find(filter)
        .sort({ issueDate: -1, createdAt: -1 })
        .limit(500)
        .lean();
      return { invoices };
    });
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const invoice = await Invoice.findOne({ _id: req.params.id, companyId: req.user!.companyId });
    if (!invoice) throw ApiError.notFound('Invoice not found');
    res.json({ invoice });
  })
);

router.post(
  '/',
  validate(invoiceSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof invoiceSchema>;
    const companyId = req.user!.companyId!;

    const customer = await Customer.findOne({ _id: body.customerId, companyId });
    if (!customer) throw ApiError.notFound('Customer not found');

    const totals = computeTotals(body.items, body.taxMode);
    const number = body.number ?? (await nextNumber(companyId, body.kind));
    const templateId = resolveTemplateId(body.template);
    const travelDetails = prepareTravel(templateId, body.travelDetails, customer);

    const invoice = await Invoice.create({
      companyId,
      customerId: customer._id,
      kind: body.kind,
      number,
      issueDate: body.issueDate ? new Date(body.issueDate) : new Date(),
      dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
      currency: body.currency,
      template: templateId,
      customerSnapshot: {
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        gstNumber: customer.gstNumber,
        panNumber: customer.panNumber,
        address: customer.address,
        city: customer.city,
        state: customer.state,
        country: customer.country,
        postalCode: customer.postalCode,
      },
      items: totals.items,
      travelDetails,
      notes: body.notes,
      terms: body.terms,
      taxMode: body.taxMode,
      subtotal: totals.subtotal,
      discountTotal: totals.discountTotal,
      taxTotal: totals.taxTotal,
      cgstTotal: totals.cgstTotal,
      sgstTotal: totals.sgstTotal,
      igstTotal: totals.igstTotal,
      grandTotal: totals.grandTotal,
      amountPaid: 0,
      balanceDue: totals.grandTotal,
      status: body.status ?? 'draft',
      tags: body.tags,
    });

    invalidateCompanyCache(companyId);
    res.status(201).json({ invoice });
  })
);

router.patch(
  '/:id',
  validate(invoiceSchema.partial()),
  asyncHandler(async (req, res) => {
    const existing = await Invoice.findOne({
      _id: req.params.id,
      companyId: req.user!.companyId,
    });
    if (!existing) throw ApiError.notFound('Invoice not found');

    const body = req.body as Partial<z.infer<typeof invoiceSchema>>;

    if (body.items) {
      const totals = computeTotals(body.items, body.taxMode ?? existing.taxMode ?? 'intra');
      existing.set('items', totals.items);
      existing.subtotal = totals.subtotal;
      existing.discountTotal = totals.discountTotal;
      existing.taxTotal = totals.taxTotal;
      existing.cgstTotal = totals.cgstTotal;
      existing.sgstTotal = totals.sgstTotal;
      existing.igstTotal = totals.igstTotal;
      existing.grandTotal = totals.grandTotal;
      existing.balanceDue = totals.grandTotal - (existing.amountPaid ?? 0);
    }

    const assignable: (keyof typeof body)[] = [
      'notes',
      'terms',
      'template',
      'currency',
      'taxMode',
      'status',
      'tags',
      'travelDetails',
      'kind',
    ];
    for (const key of assignable) {
      if (key === 'template' || key === 'travelDetails') continue;
      if (body[key] !== undefined) {
        (existing as unknown as Record<string, unknown>)[key as string] = body[key];
      }
    }

    const templateId = resolveTemplateId(body.template ?? existing.template);
    existing.template = templateId;

    if (body.travelDetails !== undefined || body.template !== undefined) {
      const customer = await Customer.findOne({
        _id: existing.customerId,
        companyId: req.user!.companyId,
      });
      if (!customer) throw ApiError.notFound('Customer not found');
      const travelInput =
        body.travelDetails !== undefined
          ? body.travelDetails
          : (JSON.parse(JSON.stringify(existing.travelDetails ?? {})) as z.infer<
              typeof travelSchema
            >);
      existing.set('travelDetails', prepareTravel(templateId, travelInput, customer));
      existing.markModified('travelDetails');
    }

    if (body.issueDate) existing.issueDate = new Date(body.issueDate);
    if (body.dueDate) existing.dueDate = new Date(body.dueDate);

    await existing.save();
    invalidateCompanyCache(req.user!.companyId as string);
    res.json({ invoice: existing });
  })
);

const paymentSchema = z.object({
  amount: z.number().min(0),
  method: z
    .enum(['upi', 'bank_transfer', 'cash', 'cheque', 'credit_card', 'debit_card', 'other'])
    .default('upi'),
  reference: z.string().max(120).optional().default(''),
  paidAt: z.string().datetime().optional(),
  note: z.string().max(1000).optional().default(''),
});

router.post(
  '/:id/payments',
  validate(paymentSchema),
  asyncHandler(async (req, res) => {
    const invoice = await Invoice.findOne({
      _id: req.params.id,
      companyId: req.user!.companyId,
    });
    if (!invoice) throw ApiError.notFound('Invoice not found');

    const body = req.body as z.infer<typeof paymentSchema>;
    invoice.payments.push({
      amount: body.amount,
      method: body.method,
      reference: body.reference,
      note: body.note,
      paidAt: body.paidAt ? new Date(body.paidAt) : new Date(),
    });
    invoice.amountPaid = (invoice.amountPaid ?? 0) + body.amount;
    invoice.balanceDue = Math.max(0, (invoice.grandTotal ?? 0) - invoice.amountPaid);
    if (invoice.balanceDue === 0) invoice.status = 'paid';
    else if (invoice.amountPaid > 0) invoice.status = 'partial';
    await invoice.save();
    invalidateCompanyCache(req.user!.companyId as string);
    res.json({ invoice });
  })
);

router.post(
  '/:id/duplicate',
  asyncHandler(async (req, res) => {
    const src = await Invoice.findOne({ _id: req.params.id, companyId: req.user!.companyId });
    if (!src) throw ApiError.notFound('Invoice not found');
    const number = await nextNumber(req.user!.companyId!, src.kind);
    const copy = await Invoice.create({
      ...src.toObject(),
      _id: undefined,
      number,
      status: 'draft',
      amountPaid: 0,
      balanceDue: src.grandTotal,
      payments: [],
      issueDate: new Date(),
      createdAt: undefined,
      updatedAt: undefined,
    });
    invalidateCompanyCache(req.user!.companyId as string);
    res.status(201).json({ invoice: copy });
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const result = await Invoice.findOneAndDelete({
      _id: req.params.id,
      companyId: req.user!.companyId,
    });
    if (!result) throw ApiError.notFound('Invoice not found');
    invalidateCompanyCache(req.user!.companyId as string);
    res.json({ ok: true });
  })
);

export default router;
