import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { env } from '../config/env';
import { FLIGHT_STATUSES } from '../models/Flight';

const SYSTEM_PROMPT = `You are an airline-ticket and flight-status email parser for an Indian travel agency.

Inputs are real mail bodies from Indian OTAs and airlines:
- OTAs: Goibibo, MakeMyTrip / MMT, Cleartrip, EaseMyTrip, Yatra, Ixigo, Paytm Travel, Booking.com Flights.
- Airlines: IndiGo (6E), Air India (AI), Air India Express (IX), Vistara (UK, legacy), SpiceJet (SG), Akasa Air (QP), Star Air (S5/OG), AIX Connect, Alliance Air (9I), Go First (G8, defunct), Air Asia India.
Many of these mails are HTML-only and have heavy marketing / footer content. The actual flight block usually appears once and is short. Search the WHOLE body — confirmations from Goibibo / MMT / Cleartrip often bury the PNR, sector and times after a long banner. Tabular layouts ("From / To / Date / Flight / PNR / Departure / Arrival") are common — read them as columns.

PDF inputs include airline e-tickets and itineraries, for example:
- Air India "Web Booking eTicket" / ELECTRONIC TICKET ITINERARY: PASSENGER name, BOOKING REFERENCE (6 chars), TICKET NUMBER, multi-sector tables (AI128 LHR–BOM), TotalAmount in INR.
- IndiGo goindigo.in itinerary printouts: "PNR/Booking Reference", passenger block, sectors like BOM–IXC with flight 6E #### and local departure/arrival times.
- Agency vouchers (Safarmate / MMT style): PNR, separate Booking Id, Issued Date, DEL–SIN sector headers, Air India AI #### with terminals and HOLD/OK status.

Given a flight ticket PDF or one such email body (any English including Indian English; possibly multi-segment), decide whether it describes a real flight booking or status update. If it does NOT (newsletter, deal alert, OTP, password reset, generic loyalty mail, hotel/rail/bus/cab booking, anything non-flight), return { "flights": [] } so the system can skip it. Do not invent data. Pull data only from what you can see.

If it IS a flight email/ticket, return EVERY distinct flight segment under "flights" using these rules:
- Output ONLY valid JSON matching the schema. No prose, no markdown.
- A round trip = TWO segments (outbound + return). A 2-stop multi-city = THREE segments. Codeshare connections each become their own segment.
- All segments share the same PNR. Differentiate them by flightNumber + departure date.
- TIMES — return ISO-8601 strings exactly as printed in the source:
    * If the source gives a timezone offset (e.g. "14:35 IST", "09:00 GMT+5:30"), return ISO WITH that offset, e.g. "2026-06-30T14:35:00+05:30".
    * If the source gives only a clock time with NO timezone, return ISO WITHOUT any 'Z' and WITHOUT any offset, e.g. "2026-06-30T14:35:00". Downstream code will treat this as Asia/Kolkata (IST, +05:30). Never append 'Z'. Never convert to UTC yourself.
    * Never guess a time you cannot see.
- PNR / booking reference: 6-character alphanumeric is typical. Always uppercase. If no PNR, leave empty.
- airlineCode is the 2-letter IATA code (e.g. AI, 6E, UK). flightNumber is the full code "6E-2134" or "AI 401" — preserve the exact format the airline used, uppercased.
- fromAirport / toAirport are 3-letter IATA codes (DEL, BOM, JAI, MAA, BLR). If only city is given, leave the code empty and put the city in fromCity / toCity.
- status must be one of: ${FLIGHT_STATUSES.join(', ')}. Use the closest match. Default to "booked" for fresh confirmations, "confirmed" once the e-ticket is issued. If the subject or body mentions delayed / rescheduled / cancelled / boarding / check-in, reflect that.
- statusNote captures any human-readable change ("Delayed by 45 min to 18:15", "Gate changed to B12", "Rescheduled to 30 Jun 09:25").
- passengers: extract each as a separate object with name + optional seat + cabin. Title-case names.
- If a field is unknown, return an empty string (or null for dates/numbers).`;

const passengerSchema = {
  type: SchemaType.OBJECT,
  properties: {
    name: { type: SchemaType.STRING },
    seat: { type: SchemaType.STRING },
    cabin: { type: SchemaType.STRING },
  },
};

const flightSegmentSchema = {
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
      description:
        'Scheduled departure. ISO-8601 with explicit offset if the source gave one (e.g. "2026-06-30T14:35:00+05:30"); otherwise naive local ISO with NO Z and NO offset (e.g. "2026-06-30T14:35:00"). Empty string if unknown.',
    },
    arrivalAt: {
      type: SchemaType.STRING,
      description:
        'Scheduled arrival. Same ISO-8601 rules as departureAt. Empty string if unknown.',
    },
    durationMinutes: { type: SchemaType.NUMBER },
    cabinClass: { type: SchemaType.STRING },
    passengers: { type: SchemaType.ARRAY, items: passengerSchema },
    status: { type: SchemaType.STRING, description: `One of: ${FLIGHT_STATUSES.join(', ')}` },
    statusNote: { type: SchemaType.STRING },
  },
};

export const flightJsonSchema = {
  type: SchemaType.OBJECT,
  properties: {
    flights: {
      type: SchemaType.ARRAY,
      description:
        'Every distinct flight segment described in the source. For a round trip return BOTH legs. For multi-city return one entry per sector. Empty array if the source is not flight-related.',
      items: flightSegmentSchema,
    },
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

// Match an ISO-like local datetime with no timezone suffix, e.g.
// "2026-06-30T14:35", "2026-06-30T14:35:00", "2026-06-30T14:35:00.123".
const NAIVE_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?$/;
// Match an ISO-like local datetime with a space separator.
const NAIVE_SPACED = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?(\.\d+)?$/;

function parseAtMost(input: string): Date | null {
  if (!input) return null;
  let value = input.trim();
  if (!value) return null;

  // If the model returned a naive local time (no Z, no offset), assume IST
  // because Node on Vercel runs in UTC and `new Date(naive)` would otherwise
  // be interpreted as UTC, shifting Indian departure times by +05:30.
  if (NAIVE_ISO.test(value)) {
    value = `${value}+05:30`;
  } else if (NAIVE_SPACED.test(value)) {
    value = `${value.replace(' ', 'T')}+05:30`;
  }

  const d = new Date(value);
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

export async function extractFlights(input: AiInput): Promise<NormalisedFlight[]> {
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
        parts.push({ text: 'Extract every flight segment from the attached ticket PDF.' });
      }

      const result = await model.generateContent({
        contents: [{ role: 'user', parts }],
      });
      const text = result.response.text();
      const parsedDoc = JSON.parse(text) as
        | { flights?: Array<Partial<ParsedFlight>> }
        | Partial<ParsedFlight>;

      // Tolerate legacy single-object responses just in case.
      const rawSegments: Array<Partial<ParsedFlight>> = Array.isArray(
        (parsedDoc as { flights?: unknown }).flights
      )
        ? ((parsedDoc as { flights: Array<Partial<ParsedFlight>> }).flights ?? [])
        : (parsedDoc as Partial<ParsedFlight>).pnr ||
          (parsedDoc as Partial<ParsedFlight>).flightNumber
        ? [parsedDoc as Partial<ParsedFlight>]
        : [];

      return rawSegments
        .map((s) => normaliseFlight(s))
        .filter((s) => s.pnr || s.flightNumber);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      lastError = message;
      const retryable = /404|not found|unsupported|not supported|deprecat/i.test(message);
      if (!retryable) break;
    }
  }

  throw new Error(`Flight extraction failed: ${lastError || 'unknown error'}`);
}

// Back-compat wrapper for callers that only want the primary segment.
export async function extractFlight(input: AiInput): Promise<NormalisedFlight> {
  const all = await extractFlights(input);
  if (all.length === 0) {
    return normaliseFlight({});
  }
  return all[0];
}
