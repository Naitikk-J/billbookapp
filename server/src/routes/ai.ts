import { Router } from 'express';
import { z } from 'zod';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';

import { env } from '../config/env';
import { Company } from '../models/Company';
import { Customer } from '../models/Customer';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import { requireAuth, requireCompany } from '../middleware/auth';
import { validate } from '../middleware/validate';

const router = Router();
router.use(requireAuth, requireCompany);

const parseSchema = z.object({
  prompt: z.string().min(3).max(2000),
});

const invoiceJsonSchema = {
  type: SchemaType.OBJECT,
  properties: {
    customer: {
      type: SchemaType.OBJECT,
      properties: {
        name: { type: SchemaType.STRING, description: 'Customer / party name' },
        phone: { type: SchemaType.STRING, description: 'Phone if mentioned, else empty' },
        email: { type: SchemaType.STRING, description: 'Email if mentioned, else empty' },
        gstNumber: { type: SchemaType.STRING, description: 'GSTIN if mentioned, else empty' },
        city: { type: SchemaType.STRING, description: 'City if mentioned, else empty' },
      },
      required: ['name'],
    },
    kind: {
      type: SchemaType.STRING,
      description: "One of: invoice, quote, proforma, receipt. Default 'invoice'.",
    },
    items: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          description: { type: SchemaType.STRING, description: 'What the line item is' },
          quantity: { type: SchemaType.NUMBER, description: 'Quantity. Default 1.' },
          unit: { type: SchemaType.STRING, description: 'Unit e.g. pax, night, hour. Empty if unknown.' },
          rate: { type: SchemaType.NUMBER, description: 'Per-unit price in INR' },
          taxPercent: {
            type: SchemaType.NUMBER,
            description: 'GST percent on this line. Default 18 unless user says otherwise or says no tax.',
          },
        },
        required: ['description', 'quantity', 'rate', 'taxPercent'],
      },
    },
    notes: { type: SchemaType.STRING, description: 'Any extra notes or empty' },
    dueDateOffsetDays: {
      type: SchemaType.NUMBER,
      description: 'Days from today the bill is due. Default 7 if not mentioned.',
    },
    currency: { type: SchemaType.STRING, description: "Currency code. Default 'INR'." },
    discountPercent: {
      type: SchemaType.NUMBER,
      description: 'Optional overall discount percent. 0 if none.',
    },
  },
  required: ['customer', 'items'],
} as const;

const SYSTEM_PROMPT = `You are an invoice extraction assistant for an Indian travel & service business billing app.
Given a natural language request (possibly Hinglish), extract a structured invoice.
Rules:
- All money in Indian Rupees (INR) unless explicitly stated otherwise.
- If the user says "total amount is X" with N items, split equally or treat as one line for the full amount with quantity 1.
- If user says GST/tax percent, use it. Else default taxPercent=18 unless the user says "no tax", "bill of supply", or "exempt" in which case use 0.
- If user mentions "from X to Y" (travel), include both in the line item description (e.g., "Flight: Jaipur to Mumbai").
- If user gives a single amount and a single item, quantity=1 and rate=that amount.
- Default kind="invoice".
- Output ONLY valid JSON matching the schema. No commentary.`;

router.post(
  '/invoice/parse',
  validate(parseSchema),
  asyncHandler(async (req, res) => {
    const company = await Company.findById(req.user!.companyId);
    if (!company) throw ApiError.notFound('Company not found');

    const apiKey = (company.geminiApiKey && company.geminiApiKey.trim()) || env.geminiApiKey;
    if (!apiKey) {
      throw ApiError.badRequest(
        'Gemini API key not configured. Add one in Settings → Company, or set GEMINI_API_KEY on the server.'
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    const seen = new Set<string>();
    const modelCandidates = [
      env.geminiModel,
      'gemini-2.5-flash',
      'gemini-flash-latest',
      'gemini-2.0-flash',
    ].filter((m): m is string => Boolean(m) && !seen.has(m) && (seen.add(m), true));

    let parsed: Record<string, unknown> | null = null;
    let lastError = '';
    for (const modelName of modelCandidates) {
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: SYSTEM_PROMPT,
        generationConfig: {
          responseMimeType: 'application/json',
          // @ts-expect-error responseSchema typing not exported on older SDK versions
          responseSchema: invoiceJsonSchema,
          temperature: 0.2,
        },
      });
      try {
        const result = await model.generateContent(req.body.prompt);
        parsed = JSON.parse(result.response.text());
        break;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        lastError = message;
        const retryable = /404|not found|unsupported|not supported|deprecat/i.test(message);
        if (!retryable) break;
      }
    }

    if (!parsed) {
      throw ApiError.badRequest(`Gemini call failed: ${lastError || 'unknown error'}`);
    }

    const customerObj = (parsed.customer ?? {}) as {
      name?: string;
      phone?: string;
      email?: string;
      gstNumber?: string;
      city?: string;
    };
    const items = Array.isArray(parsed.items) ? (parsed.items as Array<Record<string, unknown>>) : [];

    let matchedCustomerId: string | null = null;
    if (customerObj.name) {
      const exact = await Customer.findOne({
        companyId: req.user!.companyId,
        name: { $regex: `^${escapeRegex(customerObj.name)}$`, $options: 'i' },
      }).select('_id');
      const fuzzy =
        exact ??
        (await Customer.findOne({
          companyId: req.user!.companyId,
          name: { $regex: escapeRegex(customerObj.name), $options: 'i' },
        }).select('_id'));
      if (fuzzy) matchedCustomerId = String(fuzzy._id);
    }

    const normalizedItems = items
      .map((it) => ({
        description: String(it.description ?? '').slice(0, 500),
        quantity: Number(it.quantity ?? 1) || 1,
        unit: String(it.unit ?? '').slice(0, 30),
        rate: Number(it.rate ?? 0) || 0,
        taxPercent: clampNumber(it.taxPercent, 0, 28, 18),
      }))
      .filter((it) => it.description);

    res.json({
      draft: {
        customer: customerObj,
        matchedCustomerId,
        items: normalizedItems,
        notes: typeof parsed.notes === 'string' ? parsed.notes : '',
        dueDateOffsetDays: clampNumber(parsed.dueDateOffsetDays, 0, 365, 7),
        currency: typeof parsed.currency === 'string' ? parsed.currency : company.currency || 'INR',
        kind:
          typeof parsed.kind === 'string' &&
          ['invoice', 'quote', 'proforma', 'receipt'].includes(parsed.kind)
            ? parsed.kind
            : 'invoice',
        discountPercent: clampNumber(parsed.discountPercent, 0, 100, 0),
      },
    });
  })
);

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export default router;
