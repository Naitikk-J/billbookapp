import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { env } from '../config/env';
import { FLIGHT_STATUSES } from '../models/Flight';

const SYSTEM_PROMPT = `You are an airline-ticket and flight-status email parser for a travel agency.

Given a flight ticket PDF or an airline / OTA email body (any English including Indian English; possibly multi-segment), extract a single primary flight segment.

Rules:
- Output ONLY valid JSON matching the schema. No prose.
- If multiple segments, pick the upcoming one (or the latest if all are past).
- All times must be returned as ISO-8601 UTC. If only a local time is given with no zone, return as ISO with no zone shift; downstream code will treat as local.
- PNR / booking reference: 6-character alphanumeric is typical. Always uppercase.
- airlineCode is the 2-letter IATA code (e.g. AI, 6E, UK). flightNumber is full code "6E-2134" or "AI 401".
- fromAirport / toAirport are 3-letter IATA codes (DEL, BOM, JAI). If only city given, leave the code empty and put city in fromCity / toCity.
- status must be one of: ${FLIGHT_STATUSES.join(', ')}. Use the closest match. Default to "booked" if the email is just a confirmation. If the subject says delayed/cancelled/boarding, reflect that.
- statusNote captures any human-readable change (e.g. "Delayed by 45 min to 18:15", "Gate changed to B12").
- passengers: extract each as a separate object with name + optional seat + cabin.
- If a field is unknown, return an empty string (or null for dates/numbers).`;

const passengerSchema = {
  type: SchemaType.OBJECT,
  properties: {
    name: { type: SchemaType.STRING },
    seat: { type: SchemaType.STRING },
    cabin: { type: SchemaType.STRING },
  },
};

export const flightJsonSchema = {
  type: SchemaType.OBJECT,
  properties: {
    pnr: { type: SchemaType.STRING, description: 'PNR / booking reference. Uppercase 6 chars typical.' },
    bookingReference: { type: SchemaType.STRING },
    airline: { type: SchemaType.STRING },
    airlineCode: { type: SchemaType.STRING },
    flightNumber: { type: SchemaType.STRING },
    fromCity: { type: SchemaType.STRING },
    fromAirport: { type: SchemaType.STRING },
    fromTerminal: { type: SchemaType.STRING },
    toCity: { type: SchemaType.STRING },
    toAirport: { type: SchemaType.STRING },
    toTerminal: { type: SchemaType.STRING },
    departureAt: {
      type: SchemaType.STRING,
      description: 'ISO-8601 local time of scheduled departure. Empty if unknown.',
    },
    arrivalAt: {
      type: SchemaType.STRING,
      description: 'ISO-8601 local time of scheduled arrival. Empty if unknown.',
    },
    durationMinutes: { type: SchemaType.NUMBER },
    cabinClass: { type: SchemaType.STRING },
    passengers: { type: SchemaType.ARRAY, items: passengerSchema },
    status: { type: SchemaType.STRING, description: `One of: ${FLIGHT_STATUSES.join(', ')}` },
    statusNote: { type: SchemaType.STRING },
  },
} as const;

export interface ParsedFlight {
  pnr: string;
  bookingReference: string;
  airline: string;
  airlineCode: string;
  flightNumber: string;
  fromCity: string;
  fromAirport: string;
  fromTerminal: string;
  toCity: string;
  toAirport: string;
  toTerminal: string;
  departureAt: string;
  arrivalAt: string;
  durationMinutes: number | null;
  cabinClass: string;
  passengers: Array<{ name: string; seat: string; cabin: string }>;
  status: string;
  statusNote: string;
}

function parseAtMost(input: string): Date | null {
  if (!input) return null;
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function pickStatus(raw: string): (typeof FLIGHT_STATUSES)[number] {
  const t = (raw || '').toLowerCase().replace(/[-\s]+/g, '_');
  const match = FLIGHT_STATUSES.find((s) => s === t);
  if (match) return match;
  if (t.includes('delay')) return 'delayed';
  if (t.includes('cancel')) return 'cancelled';
  if (t.includes('board')) return 'boarding';
  if (t.includes('check')) return 'checked_in';
  if (t.includes('depart')) return 'departed';
  if (t.includes('arriv') || t.includes('landed')) return 'arrived';
  if (t.includes('miss')) return 'missed';
  if (t.includes('confirm')) return 'confirmed';
  return 'booked';
}

export interface NormalisedFlight {
  pnr: string;
  bookingReference: string;
  airline: string;
  airlineCode: string;
  flightNumber: string;
  fromCity: string;
  fromAirport: string;
  fromTerminal: string;
  toCity: string;
  toAirport: string;
  toTerminal: string;
  departureAt: Date | null;
  arrivalAt: Date | null;
  durationMinutes: number | null;
  cabinClass: string;
  passengers: Array<{ name: string; seat: string; cabin: string }>;
  status: (typeof FLIGHT_STATUSES)[number];
  statusNote: string;
}

export function normaliseFlight(raw: Partial<ParsedFlight>): NormalisedFlight {
  const passengers: Array<Partial<{ name: string; seat: string; cabin: string }>> = Array.isArray(
    raw.passengers
  )
    ? (raw.passengers as Array<Partial<{ name: string; seat: string; cabin: string }>>)
    : [];
  return {
    pnr: (raw.pnr ?? '').trim().toUpperCase(),
    bookingReference: (raw.bookingReference ?? '').trim(),
    airline: (raw.airline ?? '').trim(),
    airlineCode: (raw.airlineCode ?? '').trim().toUpperCase(),
    flightNumber: (raw.flightNumber ?? '').trim().toUpperCase(),
    fromCity: (raw.fromCity ?? '').trim(),
    fromAirport: (raw.fromAirport ?? '').trim().toUpperCase(),
    fromTerminal: (raw.fromTerminal ?? '').trim(),
    toCity: (raw.toCity ?? '').trim(),
    toAirport: (raw.toAirport ?? '').trim().toUpperCase(),
    toTerminal: (raw.toTerminal ?? '').trim(),
    departureAt: parseAtMost(raw.departureAt ?? ''),
    arrivalAt: parseAtMost(raw.arrivalAt ?? ''),
    durationMinutes:
      typeof raw.durationMinutes === 'number' && Number.isFinite(raw.durationMinutes)
        ? Math.max(0, Math.round(raw.durationMinutes))
        : null,
    cabinClass: (raw.cabinClass ?? '').trim(),
    passengers: passengers
      .filter((p) => !!p && typeof p === 'object')
      .map((p) => ({
        name: (p.name ?? '').trim(),
        seat: (p.seat ?? '').trim(),
        cabin: (p.cabin ?? '').trim(),
      }))
      .filter((p) => p.name),
    status: pickStatus(raw.status ?? ''),
    statusNote: (raw.statusNote ?? '').trim(),
  };
}

export interface AiInput {
  apiKey: string;
  text?: string;
  pdf?: { base64: string; mimeType: string };
}

const MODEL_CANDIDATES = ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-2.0-flash'];

export async function extractFlight(input: AiInput): Promise<NormalisedFlight> {
  if (!input.apiKey) {
    throw new Error('Gemini API key not configured. Add one in Settings → AI assistant.');
  }
  if (!input.text && !input.pdf) {
    throw new Error('Pass either text or a PDF buffer.');
  }

  const genAI = new GoogleGenerativeAI(input.apiKey);

  let lastError = '';
  const candidates = Array.from(new Set([env.geminiModel, ...MODEL_CANDIDATES])).filter(Boolean);

  for (const modelName of candidates) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: SYSTEM_PROMPT,
        generationConfig: {
          responseMimeType: 'application/json',
          // @ts-expect-error responseSchema not in older SDK types
          responseSchema: flightJsonSchema,
          temperature: 0.1,
        },
      });

      const parts: Array<
        { text: string } | { inlineData: { data: string; mimeType: string } }
      > = [];
      if (input.text) parts.push({ text: input.text });
      if (input.pdf) {
        parts.push({
          inlineData: { data: input.pdf.base64, mimeType: input.pdf.mimeType },
        });
        parts.push({ text: 'Extract the flight details from the attached ticket PDF.' });
      }

      const result = await model.generateContent({
        contents: [{ role: 'user', parts }],
      });
      const text = result.response.text();
      const parsed = JSON.parse(text) as Partial<ParsedFlight>;
      return normaliseFlight(parsed);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      lastError = message;
      const retryable = /404|not found|unsupported|not supported|deprecat/i.test(message);
      if (!retryable) break;
    }
  }

  throw new Error(`Flight extraction failed: ${lastError || 'unknown error'}`);
}
