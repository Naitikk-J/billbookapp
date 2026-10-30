import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { env } from '../config/env';

export interface FlightBillCharges {
  currency: string;
  grandTotal: number;
  airfare: number;
  taxesAndFees: number;
  serviceFee: number;
  discount: number;
  billToName: string;
  pnr: string;
  bookingId: string;
  issuedDate: string;
}

const chargesSchema = {
  type: SchemaType.OBJECT,
  properties: {
    currency: { type: SchemaType.STRING, description: 'ISO currency, default INR' },
    grandTotal: {
      type: SchemaType.NUMBER,
      description: 'Total amount payable on the bill in the document currency',
    },
    airfare: { type: SchemaType.NUMBER, description: 'Base airfare / fare before service fee' },
    taxesAndFees: { type: SchemaType.NUMBER, description: 'Taxes, fuel surcharge, airport fees combined' },
    serviceFee: { type: SchemaType.NUMBER, description: 'Platform / convenience / service fee if shown separately' },
    discount: { type: SchemaType.NUMBER, description: 'Any discount or funded discount amount (positive number)' },
    billToName: {
      type: SchemaType.STRING,
      description: 'Customer / passenger / bill-to name if visible',
    },
    pnr: { type: SchemaType.STRING, description: 'Airline PNR / booking reference (6 chars typical)' },
    bookingId: {
      type: SchemaType.STRING,
      description: 'OTA or agency booking id if different from airline PNR',
    },
    issuedDate: {
      type: SchemaType.STRING,
      description: 'Ticket/voucher issued date as printed (any readable format)',
    },
  },
} as const;

const CHARGES_PROMPT = `You extract monetary totals from Indian flight tax invoices, e-tickets, and OTA booking PDFs (MakeMyTrip, Goibibo, Cleartrip, IndiGo, Air India, etc.).
Return ONLY JSON matching the schema. Use numbers in the document currency (usually INR). If a field is not visible, use 0 for numbers and empty string for text. Do not invent amounts.`;

const MODEL_CANDIDATES = ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-2.0-flash'];

export async function extractFlightBillCharges(input: {
  apiKey: string;
  pdf: { base64: string; mimeType: string };
}): Promise<FlightBillCharges> {
  const genAI = new GoogleGenerativeAI(input.apiKey);
  let lastError = '';
  const candidates = Array.from(new Set([env.geminiModel, ...MODEL_CANDIDATES])).filter(Boolean);

  for (const modelName of candidates) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: CHARGES_PROMPT,
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: chargesSchema,
          temperature: 0.1,
        },
      });

      const result = await model.generateContent({
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  data: input.pdf.base64,
                  mimeType: input.pdf.mimeType,
                },
              },
              {
                text: 'Extract grand total, fare breakup, service fee, discount, currency, and bill-to name from this flight bill PDF.',
              },
            ],
          },
        ],
      });

      const raw = JSON.parse(result.response.text()) as Partial<FlightBillCharges>;
      return {
        currency: (raw.currency ?? 'INR').trim() || 'INR',
        grandTotal: Math.max(0, Number(raw.grandTotal) || 0),
        airfare: Math.max(0, Number(raw.airfare) || 0),
        taxesAndFees: Math.max(0, Number(raw.taxesAndFees) || 0),
        serviceFee: Math.max(0, Number(raw.serviceFee) || 0),
        discount: Math.max(0, Number(raw.discount) || 0),
        billToName: (raw.billToName ?? '').trim(),
        pnr: (raw.pnr ?? '').trim().toUpperCase(),
        bookingId: (raw.bookingId ?? '').trim().toUpperCase(),
        issuedDate: (raw.issuedDate ?? '').trim(),
      };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      const retryable = /404|not found|unsupported|not supported|deprecat/i.test(lastError);
      if (!retryable) break;
    }
  }

  return {
    currency: 'INR',
    grandTotal: 0,
    airfare: 0,
    taxesAndFees: 0,
    serviceFee: 0,
    discount: 0,
    billToName: '',
    pnr: '',
    bookingId: '',
    issuedDate: '',
  };
}
