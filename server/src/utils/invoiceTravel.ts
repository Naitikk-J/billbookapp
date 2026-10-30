import type { InvoiceTemplateId } from '../config/invoiceTemplates';

export const BOOKING_TAX_TEMPLATE: InvoiceTemplateId = 'hotel-booking-tax';

export type BookingType = 'hotel' | 'flight';

export interface TravelDetailsInput {
  bookingType?: BookingType | string;
  packageName?: string;
  destination?: string;
  startDate?: string | Date;
  endDate?: string | Date;
  adults?: number;
  children?: number;
  hotel?: string;
  flight?: string;
  vehicle?: string;
  notes?: string;
  bookingId?: string;
  hotelCity?: string;
  travellerName?: string;
  travellerPan?: string;
  panHolderName?: string;
  advancedReceiptVoucherNo?: string;
  placeOfSupply?: string;
  transactionalCategory?: string;
  transactionalDetails?: string;
  serviceDescription?: string;
  flightSegments?: unknown[];
  barcodeSnapshots?: unknown[];
}

export interface CustomerTravelContext {
  name?: string;
  state?: string;
  gstNumber?: string;
  panNumber?: string;
}

function clean(value?: string | null): string {
  return (value ?? '').trim();
}

function toDate(value?: string | Date): Date | undefined {
  if (!value) return undefined;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export function inferBookingType(td: TravelDetailsInput | undefined): BookingType {
  const raw = td ?? {};
  const explicit = clean(raw.bookingType);
  if (explicit === 'hotel' || explicit === 'flight') return explicit;

  const hasHotel = Boolean(clean(raw.hotel) || clean(raw.hotelCity));
  const hasFlight = Boolean(clean(raw.flight));
  const packageLooksHotel =
    Boolean(clean(raw.packageName)) && !hasFlight && !/[A-Z]{2}\s*\d+/i.test(clean(raw.packageName));

  if (hasFlight && !hasHotel && !packageLooksHotel) return 'flight';
  if (hasHotel || packageLooksHotel) return 'hotel';
  if (hasFlight) return 'flight';
  return 'hotel';
}

/** Fill empty booking-tax fields from generic travel data — never removes existing values. */
export function coerceBookingTaxInput(td: TravelDetailsInput): TravelDetailsInput {
  const bookingType = inferBookingType(td);
  const out: TravelDetailsInput = { ...td, bookingType };

  if (bookingType === 'hotel') {
    if (!clean(out.hotel) && clean(out.packageName)) out.hotel = out.packageName;
    if (!clean(out.hotelCity) && clean(out.destination)) out.hotelCity = out.destination;
  } else {
    if (!clean(out.bookingId) && clean(out.packageName)) out.bookingId = out.packageName;
    if (!clean(out.destination) && clean(out.hotelCity)) out.destination = out.hotelCity;
  }

  return out;
}

function buildNormalizedRecord(
  template: InvoiceTemplateId,
  td: TravelDetailsInput,
  customer: CustomerTravelContext,
  bookingType: BookingType
): Record<string, unknown> {
  const bookingId = clean(td.bookingId) || clean(td.packageName);
  const hotelCity = clean(td.hotelCity) || clean(td.destination);
  const travellerName = clean(td.travellerName) || clean(customer.name);
  const travellerPan = clean(td.travellerPan) || clean(customer.panNumber);
  const panHolderName = clean(td.panHolderName) || travellerName.toUpperCase();
  const placeOfSupply = clean(td.placeOfSupply) || clean(customer.state) || '';
  const transactionalCategory =
    clean(td.transactionalCategory) || (clean(customer.gstNumber) ? 'REG/B2B' : 'REG/B2C');
  const transactionalDetails = clean(td.transactionalDetails) || 'RG';

  const defaultHotelService =
    'Reservation service for accommodation, tour operator and tourist assistance services';
  const defaultFlightService =
    'Reservation service for air transport, tour operator and tourist assistance services';

  const serviceDescription =
    clean(td.serviceDescription) ||
    (template === BOOKING_TAX_TEMPLATE
      ? bookingType === 'flight'
        ? defaultFlightService
        : defaultHotelService
      : '');

  return {
    bookingType,
    packageName: clean(td.packageName),
    destination: clean(td.destination),
    startDate: toDate(td.startDate),
    endDate: toDate(td.endDate),
    adults: Math.max(0, Math.floor(Number(td.adults) || 0)),
    children: Math.max(0, Math.floor(Number(td.children) || 0)),
    hotel: clean(td.hotel),
    flight: clean(td.flight),
    vehicle: clean(td.vehicle),
    notes: clean(td.notes),
    bookingId,
    hotelCity,
    travellerName,
    travellerPan,
    panHolderName,
    advancedReceiptVoucherNo: clean(td.advancedReceiptVoucherNo),
    placeOfSupply,
    transactionalCategory,
    transactionalDetails,
    serviceDescription,
    flightSegments: Array.isArray(td.flightSegments) ? td.flightSegments : [],
    barcodeSnapshots: Array.isArray(td.barcodeSnapshots)
      ? td.barcodeSnapshots.filter((s): s is string => typeof s === 'string' && s.length > 0).slice(0, 8)
      : [],
  };
}

export function normalizeTravelDetails(
  template: InvoiceTemplateId,
  raw: TravelDetailsInput | undefined,
  customer: CustomerTravelContext
): Record<string, unknown> {
  const input =
    template === BOOKING_TAX_TEMPLATE ? coerceBookingTaxInput(raw ?? {}) : (raw ?? {});
  const bookingType = inferBookingType(input);
  return buildNormalizedRecord(template, input, customer, bookingType);
}

export function validateTravelForTemplate(
  _template: InvoiceTemplateId,
  _travel: ReturnType<typeof normalizeTravelDetails>
): string | null {
  return null;
}
