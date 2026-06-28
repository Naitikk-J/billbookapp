import { Router } from 'express';
import { z } from 'zod';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';

import { env } from '../config/env';
import { Company } from '../models/Company';
import { Flight, FLIGHT_STATUSES, type FlightDoc, type FlightStatus } from '../models/Flight';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import { requireAuth, requireCompany } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  extractFlight,
  normaliseFlight,
  type NormalisedFlight,
} from '../utils/flightAi';

const router = Router();
router.use(requireAuth, requireCompany);

const passengerSchema = z.object({
  name: z.string().max(200).optional().default(''),
  seat: z.string().max(20).optional().default(''),
  cabin: z.string().max(40).optional().default(''),
});

const baseFlightSchema = z.object({
  pnr: z.string().max(40).optional().default(''),
  bookingReference: z.string().max(80).optional().default(''),
  airline: z.string().max(120).optional().default(''),
  airlineCode: z.string().max(8).optional().default(''),
  flightNumber: z.string().max(20).optional().default(''),
  fromCity: z.string().max(120).optional().default(''),
  fromAirport: z.string().max(8).optional().default(''),
  fromTerminal: z.string().max(20).optional().default(''),
  toCity: z.string().max(120).optional().default(''),
  toAirport: z.string().max(8).optional().default(''),
  toTerminal: z.string().max(20).optional().default(''),
  departureAt: z.string().datetime().optional().or(z.literal('')).or(z.null()),
  arrivalAt: z.string().datetime().optional().or(z.literal('')).or(z.null()),
  durationMinutes: z.number().min(0).max(60 * 48).optional().nullable(),
  cabinClass: z.string().max(40).optional().default(''),
  passengers: z.array(passengerSchema).max(20).optional().default([]),
  status: z.enum(FLIGHT_STATUSES).optional().default('booked'),
  statusNote: z.string().max(500).optional().default(''),
  notes: z.string().max(2000).optional().default(''),
  color: z.string().max(20).optional().default(''),
  tags: z.array(z.string().max(40)).max(20).optional().default([]),
  customerId: z.string().optional().nullable(),
});

const createSchema = baseFlightSchema;
const updateSchema = baseFlightSchema.partial().extend({
  status: z.enum(FLIGHT_STATUSES).optional(),
  position: z.number().int().min(0).optional(),
});

const moveSchema = z.object({
  status: z.enum(FLIGHT_STATUSES),
  position: z.number().int().min(0).optional(),
});

const parseTextSchema = z.object({
  text: z.string().min(10).max(50_000),
  subject: z.string().max(500).optional().default(''),
  from: z.string().max(200).optional().default(''),
  date: z.string().datetime().optional(),
});

const parsePdfSchema = z.object({
  fileName: z.string().max(200).optional().default('ticket.pdf'),
  mimeType: z.string().max(80).optional().default('application/pdf'),
  base64: z.string().min(64),
});

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value !== 'string') return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const flights = await Flight.find({ companyId: req.user!.companyId })
      .sort({ status: 1, position: 1, departureAt: 1 })
      .lean();
    const board: Record<FlightStatus, typeof flights> = FLIGHT_STATUSES.reduce(
      (acc, s) => ({ ...acc, [s]: [] }),
      {} as Record<FlightStatus, typeof flights>
    );
    for (const f of flights) {
      const s = (f.status as FlightStatus) || 'booked';
      if (!board[s]) board[s] = [];
      board[s].push(f);
    }
    res.json({ flights, board });
  })
);

router.post(
  '/',
  validate(createSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof createSchema>;
    const status = body.status ?? 'booked';
    const maxInColumn = await Flight.find({ companyId: req.user!.companyId, status })
      .sort({ position: -1 })
      .limit(1)
      .lean();
    const position = (maxInColumn[0]?.position ?? 0) + 1;
    const flight = await Flight.create({
      ...body,
      companyId: req.user!.companyId,
      departureAt: toDate(body.departureAt),
      arrivalAt: toDate(body.arrivalAt),
      position,
      source: 'manual',
      history: [{ kind: 'create', message: 'Card created manually', at: new Date() }],
    });
    res.status(201).json({ flight });
  })
);

router.patch(
  '/:id',
  validate(updateSchema),
  asyncHandler(async (req, res) => {
    const flight = await Flight.findOne({
      _id: req.params.id,
      companyId: req.user!.companyId,
    });
    if (!flight) throw ApiError.notFound('Flight not found');
    const body = req.body as Partial<z.infer<typeof updateSchema>>;

    const previousStatus = flight.status;
    for (const [key, value] of Object.entries(body)) {
      if (value === undefined) continue;
      if (key === 'departureAt' || key === 'arrivalAt') {
        (flight as unknown as Record<string, unknown>)[key] = toDate(value);
      } else {
        (flight as unknown as Record<string, unknown>)[key] = value;
      }
    }

    if (body.status && body.status !== previousStatus) {
      flight.history.push({
        at: new Date(),
        kind: 'status',
        message: `Status changed: ${previousStatus} → ${body.status}`,
      });
    }

    await flight.save();
    res.json({ flight });
  })
);

router.post(
  '/:id/move',
  validate(moveSchema),
  asyncHandler(async (req, res) => {
    const flight = await Flight.findOne({
      _id: req.params.id,
      companyId: req.user!.companyId,
    });
    if (!flight) throw ApiError.notFound('Flight not found');
    const { status, position } = req.body as z.infer<typeof moveSchema>;
    const previousStatus = flight.status;
    flight.status = status;
    if (typeof position === 'number') flight.position = position;
    if (previousStatus !== status) {
      flight.history.push({
        at: new Date(),
        kind: 'status',
        message: `Moved: ${previousStatus} → ${status}`,
      });
    }
    await flight.save();
    res.json({ flight });
  })
);

const reorderSchema = z.object({
  orders: z
    .array(
      z.object({
        id: z.string().min(1),
        status: z.enum(FLIGHT_STATUSES),
        position: z.number().int().min(0),
      })
    )
    .max(500),
});

router.post(
  '/reorder',
  validate(reorderSchema),
  asyncHandler(async (req, res) => {
    const { orders } = req.body as z.infer<typeof reorderSchema>;
    const ops = orders.map((o) => ({
      updateOne: {
        filter: { _id: o.id, companyId: req.user!.companyId },
        update: { $set: { status: o.status, position: o.position } },
      },
    }));
    if (ops.length > 0) await Flight.bulkWrite(ops);
    res.json({ ok: true });
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const result = await Flight.findOneAndDelete({
      _id: req.params.id,
      companyId: req.user!.companyId,
    });
    if (!result) throw ApiError.notFound('Flight not found');
    res.json({ ok: true });
  })
);

async function resolveApiKey(companyId: string): Promise<string> {
  const company = await Company.findById(companyId).select('geminiApiKey');
  const apiKey =
    (company?.geminiApiKey && company.geminiApiKey.trim()) || env.geminiApiKey;
  if (!apiKey) {
    throw ApiError.badRequest(
      'Gemini API key not configured. Add one in Settings → AI assistant.'
    );
  }
  return apiKey;
}

async function upsertFromExtraction(
  companyId: string,
  parsed: NormalisedFlight,
  metadata: {
    source: 'email' | 'pdf' | 'manual';
    sourceRef?: string;
    emailSubject?: string;
    emailFrom?: string;
    emailDate?: Date | null;
    rawSnippet?: string;
    pdfName?: string;
  }
): Promise<{ flight: FlightDoc; created: boolean }> {
  let existing: FlightDoc | null = null;
  if (parsed.pnr) {
    existing = (await Flight.findOne({ companyId, pnr: parsed.pnr })) as FlightDoc | null;
  }
  if (!existing && parsed.flightNumber && parsed.departureAt) {
    const day = new Date(parsed.departureAt);
    const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate());
    const dayEnd = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1);
    existing = (await Flight.findOne({
      companyId,
      flightNumber: parsed.flightNumber,
      departureAt: { $gte: dayStart, $lt: dayEnd },
    })) as FlightDoc | null;
  }
  if (!existing && metadata.sourceRef) {
    existing = (await Flight.findOne({
      companyId,
      sourceRef: metadata.sourceRef,
    })) as FlightDoc | null;
  }

  if (existing) {
    const previous = {
      status: existing.status,
      departureAt: existing.departureAt,
      arrivalAt: existing.arrivalAt,
      fromTerminal: existing.fromTerminal,
      toTerminal: existing.toTerminal,
    };

    const changes: string[] = [];
    const fields: Array<keyof NormalisedFlight> = [
      'airline',
      'airlineCode',
      'flightNumber',
      'fromCity',
      'fromAirport',
      'fromTerminal',
      'toCity',
      'toAirport',
      'toTerminal',
      'cabinClass',
      'bookingReference',
    ];
    for (const f of fields) {
      const incoming = (parsed[f] as string) ?? '';
      const current = (existing[f] as string) ?? '';
      if (incoming && incoming !== current) {
        (existing as unknown as Record<string, unknown>)[f] = incoming;
      }
    }
    if (parsed.departureAt) existing.departureAt = parsed.departureAt;
    if (parsed.arrivalAt) existing.arrivalAt = parsed.arrivalAt;
    if (parsed.durationMinutes != null) existing.durationMinutes = parsed.durationMinutes;
    if (parsed.passengers.length) existing.set('passengers', parsed.passengers);
    if (parsed.status) {
      if (existing.status !== parsed.status) {
        changes.push(`status ${previous.status} → ${parsed.status}`);
      }
      existing.status = parsed.status;
    }
    if (parsed.statusNote) existing.statusNote = parsed.statusNote;
    if (metadata.source === 'email') {
      existing.lastEmailAt = metadata.emailDate ?? new Date();
      if (metadata.emailSubject) existing.emailSubject = metadata.emailSubject;
      if (metadata.emailFrom) existing.emailFrom = metadata.emailFrom;
      if (metadata.rawSnippet) existing.rawSnippet = metadata.rawSnippet.slice(0, 1000);
    }

    if (previous.departureAt && parsed.departureAt) {
      if (Math.abs(previous.departureAt.getTime() - parsed.departureAt.getTime()) > 60_000) {
        changes.push(
          `departure ${previous.departureAt.toISOString()} → ${parsed.departureAt.toISOString()}`
        );
      }
    }
    if (parsed.fromTerminal && previous.fromTerminal && parsed.fromTerminal !== previous.fromTerminal) {
      changes.push(`gate/terminal ${previous.fromTerminal} → ${parsed.fromTerminal}`);
    }

    existing.history.push({
      at: new Date(),
      kind: metadata.source,
      message: changes.length
        ? `Updated from ${metadata.source}: ${changes.join('; ')}`
        : `Refreshed from ${metadata.source}`,
    });

    await existing.save();
    return { flight: existing, created: false };
  }

  const maxInColumn = await Flight.find({ companyId, status: parsed.status })
    .sort({ position: -1 })
    .limit(1)
    .lean();
  const position = (maxInColumn[0]?.position ?? 0) + 1;

  const flight = (await Flight.create({
    companyId,
    ...parsed,
    position,
    source: metadata.source,
    sourceRef: metadata.sourceRef ?? '',
    emailSubject: metadata.emailSubject ?? '',
    emailFrom: metadata.emailFrom ?? '',
    emailDate: metadata.emailDate ?? null,
    rawSnippet: (metadata.rawSnippet ?? '').slice(0, 1000),
    lastEmailAt: metadata.source === 'email' ? metadata.emailDate ?? new Date() : null,
    pdfName: metadata.pdfName ?? '',
    history: [
      {
        at: new Date(),
        kind: metadata.source,
        message: `Card created from ${metadata.source}`,
      },
    ],
  })) as FlightDoc;
  return { flight, created: true };
}

router.post(
  '/parse-text',
  validate(parseTextSchema),
  asyncHandler(async (req, res) => {
    const companyId = req.user!.companyId as string;
    const apiKey = await resolveApiKey(companyId);
    const body = req.body as z.infer<typeof parseTextSchema>;

    const composed = `Subject: ${body.subject || '(no subject)'}\nFrom: ${body.from || ''}\nDate: ${
      body.date || ''
    }\n\n${body.text}`;

    const parsed = await extractFlight({ apiKey, text: composed });
    const { flight, created } = await upsertFromExtraction(companyId, parsed, {
      source: 'email',
      sourceRef: body.subject ? `subject:${body.subject.slice(0, 180)}` : '',
      emailSubject: body.subject,
      emailFrom: body.from,
      emailDate: body.date ? new Date(body.date) : new Date(),
      rawSnippet: body.text.slice(0, 1000),
    });
    res.status(created ? 201 : 200).json({ flight, created });
  })
);

router.post(
  '/parse-pdf',
  validate(parsePdfSchema),
  asyncHandler(async (req, res) => {
    const companyId = req.user!.companyId as string;
    const apiKey = await resolveApiKey(companyId);
    const body = req.body as z.infer<typeof parsePdfSchema>;
    const base64 = body.base64.replace(/^data:.*?;base64,/, '');

    const parsed = await extractFlight({
      apiKey,
      pdf: { base64, mimeType: body.mimeType || 'application/pdf' },
    });
    const { flight, created } = await upsertFromExtraction(companyId, parsed, {
      source: 'pdf',
      pdfName: body.fileName,
    });
    res.status(created ? 201 : 200).json({ flight, created });
  })
);

// Cheap pre-filter to avoid spending AI tokens on obvious non-mail
// (newsletters, password resets, bills, social notifs). We do NOT use a
// flight-keyword allowlist — we want every mail that *might* be a flight to
// reach the model, so the model gets to decide. Only the most blatantly
// non-flight things are dropped here.
const HARD_SKIP_SUBJECTS = [
  'unsubscribe',
  'verify your email',
  'reset your password',
  'one-time password',
  'security alert',
  'invitation to connect',
  'two-factor',
  'otp ',
];

function shouldHardSkip(subject: string, fromText: string): boolean {
  const s = subject.toLowerCase();
  const f = fromText.toLowerCase();
  if (HARD_SKIP_SUBJECTS.some((kw) => s.includes(kw))) return true;
  // Common non-flight senders. Keep narrow on purpose.
  if (/(linkedin|github|stackoverflow|notifications@|noreply@medium)/i.test(f)) return true;
  return false;
}

// Process N items in parallel, capped concurrency.
async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const idx = cursor++;
      if (idx >= items.length) return;
      results[idx] = await worker(items[idx], idx);
    }
  });
  await Promise.all(runners);
  return results;
}

router.post(
  '/email/sync',
  asyncHandler(async (req, res) => {
    const start = Date.now();
    const companyId = req.user!.companyId as string;
    const company = await Company.findById(companyId);
    if (!company) throw ApiError.notFound('Company not found');
    if (!company.gmailAddress || !company.gmailAppPassword) {
      throw ApiError.badRequest(
        'Gmail address + App Password not configured. Add them in Settings → Flight automation.'
      );
    }
    const apiKey = await resolveApiKey(companyId);

    const body = (req.body ?? {}) as {
      since?: string;
      limit?: number;
      lookbackDays?: number;
    };
    const sinceParam = body.since ?? '';
    const lookbackDays = Math.max(1, Math.min(Number(body.lookbackDays ?? 30), 180));
    const fallbackSince = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);
    const since = sinceParam
      ? new Date(sinceParam)
      : company.lastFlightSyncAt ?? fallbackSince;
    const limit = Math.min(Math.max(Number(body.limit ?? 30), 1), 60);
    // Stop accepting new work once we're this deep into the time budget so
    // we have headroom for IMAP logout + Mongo write + response. vercel.json
    // sets maxDuration=60s.
    const TIME_BUDGET_MS = 48_000;

    const client = new ImapFlow({
      host: 'imap.gmail.com',
      port: 993,
      secure: true,
      logger: false,
      auth: {
        user: company.gmailAddress,
        pass: company.gmailAppPassword,
      },
    });

    const summary = { scanned: 0, parsed: 0, created: 0, updated: 0, skipped: 0 };
    const errors: string[] = [];
    let hasMore = false;
    let nextSince: string | null = null;
    let newestProcessedAt: Date | null = null;

    interface PreparedMessage {
      uid: number;
      messageId: string;
      subject: string;
      fromText: string;
      dateValue: Date;
      cleanBody: string;
    }

    try {
      await client.connect();
      const lock = await client.getMailboxLock('INBOX');
      try {
        const uidsResult = await client.search({ since });
        const uids: number[] = Array.isArray(uidsResult) ? uidsResult.slice() : [];
        // Oldest-first so we can advance the cursor monotonically and the
        // next page picks up right where we stopped.
        uids.sort((a, b) => a - b);
        const candidates = uids.slice(0, limit);
        hasMore = uids.length > candidates.length;

        // Step 1: fetch + parse all envelopes/bodies serially (IMAP needs the lock).
        const prepared: PreparedMessage[] = [];
        for (const uid of candidates) {
          if (Date.now() - start > TIME_BUDGET_MS) {
            hasMore = true;
            break;
          }
          try {
            const message = await client.fetchOne(uid, { source: true, envelope: true });
            if (!message || !message.source) continue;
            const parsedMail = await simpleParser(message.source);
            const subject = parsedMail.subject ?? '';
            const fromText =
              parsedMail.from?.text ?? message.envelope?.from?.[0]?.address ?? '';
            const dateValue = parsedMail.date ?? message.envelope?.date ?? new Date();
            const textBody = parsedMail.text || parsedMail.html || '';
            const cleanBody = String(textBody).replace(/\s+/g, ' ').trim().slice(0, 12_000);
            prepared.push({
              uid,
              messageId: message.envelope?.messageId ?? `uid-${uid}`,
              subject,
              fromText,
              dateValue,
              cleanBody,
            });
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            errors.push(`fetch uid ${uid}: ${message.slice(0, 200)}`);
          }
        }

        summary.scanned = prepared.length;

        // Step 2: ship each to Gemini in parallel batches. Skip obvious noise
        // upfront to keep token spend reasonable. Everything else gets the
        // model — the model decides whether it's actually a flight.
        await mapWithConcurrency(prepared, 4, async (msg) => {
          // If we've blown the time budget, mark as not-yet-processed so the
          // cursor doesn't advance past it.
          if (Date.now() - start > TIME_BUDGET_MS) {
            hasMore = true;
            return;
          }

          if (shouldHardSkip(msg.subject, msg.fromText)) {
            summary.skipped += 1;
            if (!newestProcessedAt || msg.dateValue > newestProcessedAt) {
              newestProcessedAt = msg.dateValue;
            }
            return;
          }

          try {
            const composed = `Subject: ${msg.subject}\nFrom: ${msg.fromText}\nDate: ${msg.dateValue.toISOString()}\n\n${msg.cleanBody}`;
            const parsed = await extractFlight({ apiKey, text: composed });

            if (!parsed.pnr && !parsed.flightNumber) {
              summary.skipped += 1;
            } else {
              const result = await upsertFromExtraction(companyId, parsed, {
                source: 'email',
                sourceRef: `imap:${msg.messageId}`,
                emailSubject: msg.subject,
                emailFrom: msg.fromText,
                emailDate: msg.dateValue,
                rawSnippet: msg.cleanBody,
              });
              summary.parsed += 1;
              if (result.created) summary.created += 1;
              else summary.updated += 1;
            }
            if (!newestProcessedAt || msg.dateValue > newestProcessedAt) {
              newestProcessedAt = msg.dateValue;
            }
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            errors.push(`uid ${msg.uid}: ${message.slice(0, 200)}`);
            summary.skipped += 1;
          }
        });
      } finally {
        lock.release();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw ApiError.badRequest(`Gmail sync failed: ${message}`);
    } finally {
      try {
        await client.logout();
      } catch {
        // ignore
      }
    }

    // Advance the high-water mark to the newest message we *finished*. If we
    // didn't finish any, leave it alone so the next call retries the same window.
    // TS narrows `newestProcessedAt` to `never` because the writes happen inside
    // closures, so we read through `unknown` to recover the actual runtime type.
    const finalNewest = newestProcessedAt as unknown as Date | null;
    if (finalNewest) {
      company.lastFlightSyncAt = finalNewest;
      await company.save();
      nextSince = finalNewest.toISOString();
    } else {
      nextSince = null;
    }

    res.json({
      summary,
      errors: errors.slice(0, 10),
      lastFlightSyncAt: company.lastFlightSyncAt,
      hasMore,
      nextSince,
      elapsedMs: Date.now() - start,
    });
  })
);

export default router;
