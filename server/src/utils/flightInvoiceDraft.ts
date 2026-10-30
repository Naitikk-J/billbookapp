import type { NormalisedFlight } from './flightAi';
import type { FlightBillCharges } from './flightBillCharges';
import { enrichCityName } from './airportNames';
export const FLIGHT_VOUCHER_TEMPLATE = 'safarmate-flight-voucher';

export interface FlightSegmentSnapshot {
  pnr: string;
  flightNumber: string;
  airline: string;
  fromCity: string;
  fromAirport: string;
  toCity: string;
  toAirport: string;
  departureAt: string | null;
  arrivalAt: string | null;
  passengers: Array<{ name: string; seat: string; cabin: string }>;
}

export interface FlightInvoiceDraft {
  template: typeof FLIGHT_VOUCHER_TEMPLATE;
  kind: 'invoice';
  currency: string;
  taxMode: 'intra' | 'none';
  customerHint: {
    name: string;
    phone: string;
    email: string;
    gstNumber: string;
    city: string;
  };
  matchedCustomerId: string | null;
  travelDetails: Record<string, unknown>;
  items: Array<{
    description: string;
    hsnCode: string;
    quantity: number;
    unit: string;
    rate: number;
    taxPercent: number;
    discountPercent: number;
  }>;
  notes: string;
  sourceFileName: string;
  segments: FlightSegmentSnapshot[];
}

function iso(d: Date | null): string | null {
  return d ? d.toISOString() : null;
}

function segmentSnapshot(f: NormalisedFlight): FlightSegmentSnapshot {
  return {
    pnr: f.pnr,
    flightNumber: f.flightNumber,
    airline: f.airline,
    fromCity: f.fromCity,
    fromAirport: f.fromAirport,
    toCity: f.toCity,
    toAirport: f.toAirport,
    departureAt: iso(f.departureAt),
    arrivalAt: iso(f.arrivalAt),
    passengers: f.passengers,
  };
}

function routeLabel(segments: NormalisedFlight[]): string {
  if (segments.length === 0) return 'Flight booking';
  const parts = segments.map((s) => {
    const from = enrichCityName(s.fromCity, s.fromAirport) || s.fromAirport || '?';
    const to = enrichCityName(s.toCity, s.toAirport) || s.toAirport || '?';
    const fn = s.flightNumber || s.airlineCode || '';
    return fn ? `${fn} ${from}–${to}` : `${from}–${to}`;
  });
  return parts.join(' · ');
}

function pickPassengerName(segments: NormalisedFlight[], billToName: string): string {
  if (billToName.trim()) return billToName.trim();
  for (const s of segments) {
    const p = s.passengers.find((x) => x.name.trim());
    if (p) return p.name.trim();
  }
  return '';
}

function matchCustomerId(
  name: string,
  customers: Array<{ _id: unknown; name: string }>
): string | null {
  const n = name.trim().toLowerCase();
  if (!n) return null;
  const exact = customers.find((c) => c.name.trim().toLowerCase() === n);
  if (exact) return String(exact._id);
  const partial = customers.find(
    (c) =>
      c.name.trim().toLowerCase().includes(n) || n.includes(c.name.trim().toLowerCase())
  );
  return partial ? String(partial._id) : null;
}

export function buildFlightInvoiceDraft(
  segments: NormalisedFlight[],
  charges: FlightBillCharges,
  customers: Array<{ _id: unknown; name: string; phone?: string; email?: string; city?: string }>,
  sourceFileName: string
): FlightInvoiceDraft {
  const primary = segments[0];
  const last = segments[segments.length - 1] ?? primary;
  const pnr =
    charges.pnr || primary?.pnr || primary?.bookingReference || segments.find((s) => s.pnr)?.pnr || '';
  const bookingId = charges.bookingId || pnr;
  const passengerName = pickPassengerName(segments, charges.billToName);
  const destination =
    enrichCityName(primary?.toCity, primary?.toAirport) ||
    primary?.toAirport ||
    [enrichCityName(primary?.fromCity, primary?.fromAirport), enrichCityName(primary?.toCity, primary?.toAirport)]
      .filter(Boolean)
      .join(' → ') ||
    '';

  const flightLine = segments
    .map((s) => {
      const label = [s.airline, s.flightNumber].filter(Boolean).join(' ').trim();
      const sector = `${s.fromAirport || s.fromCity}–${s.toAirport || s.toCity}`.trim();
      return [label, sector].filter(Boolean).join(' · ');
    })
    .join(' / ');

  const grand = charges.grandTotal;
  let serviceFee = charges.serviceFee;
  let airfare =
    charges.airfare > 0
      ? charges.airfare + charges.taxesAndFees
      : Math.max(0, grand - serviceFee + charges.discount);

  if (grand > 0 && airfare <= 0 && serviceFee <= 0) {
    airfare = grand;
  }
  if (grand > 0 && serviceFee <= 0 && airfare + serviceFee > grand) {
    airfare = grand;
  }

  const items: FlightInvoiceDraft['items'] = [];
  if (airfare > 0) {
    items.push({
      description: `Flight — ${routeLabel(segments)}`,
      hsnCode: '998552',
      quantity: 1,
      unit: 'pax',
      rate: airfare,
      taxPercent: 0,
      discountPercent: 0,
    });
  }
  if (serviceFee > 0) {
    items.push({
      description: 'Service Fees',
      hsnCode: '998552',
      quantity: 1,
      unit: 'nos',
      rate: serviceFee,
      taxPercent: 18,
      discountPercent: 0,
    });
  }
  if (items.length === 0 && grand > 0) {
    items.push({
      description: `Flight — ${routeLabel(segments)}`,
      hsnCode: '998552',
      quantity: 1,
      unit: 'pax',
      rate: grand,
      taxPercent: 0,
      discountPercent: 0,
    });
  }

  const discountPercent =
    charges.discount > 0 && grand > 0
      ? Math.min(100, Math.round((charges.discount / (grand + charges.discount)) * 10000) / 100)
      : 0;

  if (discountPercent > 0 && items[0]) {
    items[0].discountPercent = discountPercent;
  }

  const matchedCustomerId = matchCustomerId(passengerName, customers);
  const matched = matchedCustomerId
    ? customers.find((c) => String(c._id) === matchedCustomerId)
    : null;

  return {
    template: FLIGHT_VOUCHER_TEMPLATE,
    kind: 'invoice',
    currency: charges.currency || 'INR',
    taxMode: items.some((i) => i.taxPercent > 0) ? 'intra' : 'none',
    customerHint: {
      name: passengerName || matched?.name || 'Flight customer',
      phone: matched?.phone ?? '',
      email: matched?.email ?? '',
      gstNumber: '',
      city: matched?.city ?? primary?.toCity ?? '',
    },
    matchedCustomerId,
    travelDetails: {
      bookingType: 'flight',
      bookingId,
      flight: flightLine,
      destination,
      startDate: iso(primary?.departureAt ?? null) ?? undefined,
      endDate: iso(last?.arrivalAt ?? last?.departureAt ?? null) ?? undefined,
      travellerName: passengerName,
      notes: charges.issuedDate ? `Issued: ${charges.issuedDate}` : '',
      flightSegments: segments.map(segmentSnapshot),
    },
    items,
    notes: `Imported from flight bill PDF: ${sourceFileName}`,
    sourceFileName,
    segments: segments.map(segmentSnapshot),
  };
}
