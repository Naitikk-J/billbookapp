import { Router } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import { Customer } from '../models/Customer';
import { LedgerEntry } from '../models/LedgerEntry';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import { requireAuth, requireCompany } from '../middleware/auth';
import { validate } from '../middleware/validate';

const router = Router();
router.use(requireAuth, requireCompany);

const entrySchema = z.object({
  kind: z.enum(['payment', 'credit']),
  amount: z.number().positive(),
  note: z.string().max(500).optional().default(''),
  method: z.enum(['cash', 'upi', 'bank', 'card', 'cheque', 'other']).optional().default('cash'),
  date: z.string().optional(),
});

router.get(
  '/summary',
  asyncHandler(async (req, res) => {
    const companyId = new Types.ObjectId(req.user!.companyId as string);
    const kindQ = req.query.kind ? String(req.query.kind) : undefined;
    const customerFilter: Record<string, unknown> = { companyId };
    if (kindQ === 'customer' || kindQ === 'supplier') customerFilter.kind = kindQ;

    const customers = await Customer.find(customerFilter).sort({ name: 1 }).lean();
    const ids = customers.map((c) => c._id);

    const totalsAgg = await LedgerEntry.aggregate([
      { $match: { companyId, customerId: { $in: ids } } },
      {
        $group: {
          _id: { customerId: '$customerId', kind: '$kind' },
          total: { $sum: '$amount' },
        },
      },
    ]);

    const lastActivityAgg = await LedgerEntry.aggregate([
      { $match: { companyId, customerId: { $in: ids } } },
      { $sort: { date: -1 } },
      { $group: { _id: '$customerId', date: { $first: '$date' } } },
    ]);
    const lastActivityById = new Map<string, Date>();
    for (const row of lastActivityAgg) lastActivityById.set(String(row._id), row.date);

    const sumsById = new Map<string, { payment: number; credit: number }>();
    for (const row of totalsAgg) {
      const id = String(row._id.customerId);
      const cur = sumsById.get(id) ?? { payment: 0, credit: 0 };
      if (row._id.kind === 'payment') cur.payment = row.total;
      if (row._id.kind === 'credit') cur.credit = row.total;
      sumsById.set(id, cur);
    }

    let netReceivable = 0;
    let netPayable = 0;
    const accounts = customers.map((c) => {
      const sums = sumsById.get(String(c._id)) ?? { payment: 0, credit: 0 };
      const balance = (c.openingBalance ?? 0) + sums.credit - sums.payment;
      if (balance > 0) netReceivable += balance;
      else netPayable += Math.abs(balance);
      return {
        _id: c._id,
        name: c.name,
        kind: c.kind ?? 'customer',
        phone: c.phone ?? '',
        email: c.email ?? '',
        city: c.city ?? '',
        balance,
        lastActivity: lastActivityById.get(String(c._id)) ?? null,
      };
    });

    accounts.sort((a, b) => {
      const al = a.lastActivity ? new Date(a.lastActivity).getTime() : 0;
      const bl = b.lastActivity ? new Date(b.lastActivity).getTime() : 0;
      if (bl !== al) return bl - al;
      return a.name.localeCompare(b.name);
    });

    res.json({
      accounts,
      totals: {
        netReceivable,
        netPayable,
        accountsCount: accounts.length,
      },
    });
  })
);

router.get(
  '/:customerId',
  asyncHandler(async (req, res) => {
    const customer = await Customer.findOne({
      _id: req.params.customerId,
      companyId: req.user!.companyId,
    });
    if (!customer) throw ApiError.notFound('Customer not found');

    const entries = await LedgerEntry.find({
      companyId: req.user!.companyId,
      customerId: customer._id,
    })
      .sort({ date: -1, createdAt: -1 })
      .lean();

    const totalPayment = entries
      .filter((e) => e.kind === 'payment')
      .reduce((s, e) => s + (e.amount || 0), 0);
    const totalCredit = entries
      .filter((e) => e.kind === 'credit')
      .reduce((s, e) => s + (e.amount || 0), 0);
    const balance = (customer.openingBalance ?? 0) + totalCredit - totalPayment;

    res.json({
      customer: {
        _id: customer._id,
        name: customer.name,
        kind: customer.kind ?? 'customer',
        phone: customer.phone ?? '',
        email: customer.email ?? '',
        city: customer.city ?? '',
        openingBalance: customer.openingBalance ?? 0,
      },
      entries,
      totals: { totalPayment, totalCredit, balance },
    });
  })
);

router.post(
  '/:customerId/entries',
  validate(entrySchema),
  asyncHandler(async (req, res) => {
    const customer = await Customer.findOne({
      _id: req.params.customerId,
      companyId: req.user!.companyId,
    });
    if (!customer) throw ApiError.notFound('Customer not found');

    const entry = await LedgerEntry.create({
      companyId: req.user!.companyId,
      customerId: customer._id,
      kind: req.body.kind,
      amount: req.body.amount,
      note: req.body.note ?? '',
      method: req.body.method ?? 'cash',
      date: req.body.date ? new Date(req.body.date) : new Date(),
    });
    res.status(201).json({ entry });
  })
);

const entryUpdateSchema = z.object({
  kind: z.enum(['payment', 'credit']).optional(),
  amount: z.number().positive().optional(),
  note: z.string().max(500).optional(),
  method: z.enum(['cash', 'upi', 'bank', 'card', 'cheque', 'other']).optional(),
  date: z.string().optional(),
});

router.patch(
  '/entries/:id',
  validate(entryUpdateSchema),
  asyncHandler(async (req, res) => {
    const entry = await LedgerEntry.findOne({
      _id: req.params.id,
      companyId: req.user!.companyId,
    });
    if (!entry) throw ApiError.notFound('Entry not found');

    const body = req.body as z.infer<typeof entryUpdateSchema>;
    if (body.kind !== undefined) entry.kind = body.kind;
    if (body.amount !== undefined) entry.amount = body.amount;
    if (body.note !== undefined) entry.note = body.note;
    if (body.method !== undefined) entry.method = body.method;
    if (body.date !== undefined) entry.date = new Date(body.date);

    await entry.save();
    res.json({ entry });
  })
);

router.delete(
  '/entries/:id',
  asyncHandler(async (req, res) => {
    const result = await LedgerEntry.findOneAndDelete({
      _id: req.params.id,
      companyId: req.user!.companyId,
    });
    if (!result) throw ApiError.notFound('Entry not found');
    res.json({ ok: true });
  })
);

export default router;
