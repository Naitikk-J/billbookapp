export type BookingType = 'hotel' | 'flight';

export const BOOKING_TAX_TEMPLATE = 'hotel-booking-tax';

export interface TravelFormSlice {
  bookingType?: BookingType | string;
  packageName?: string;
  destination?: string;
  startDate?: string;
  endDate?: string;
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
}

function clean(value?: string | null): string {
  return (value ?? '').trim();
}

export function inferBookingType(td: TravelFormSlice | undefined): BookingType {
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

/** Fill empty booking-tax fields only — keeps every value already on the invoice. */
export function coerceBookingTaxInput(td: TravelFormSlice): TravelFormSlice {
  const bookingType = inferBookingType(td);
  const out: TravelFormSlice = { ...td, bookingType };

  if (bookingType === 'hotel') {
    if (!clean(out.hotel) && clean(out.packageName)) out.hotel = out.packageName;
    if (!clean(out.hotelCity) && clean(out.destination)) out.hotelCity = out.destination;
  } else {
    if (!clean(out.bookingId) && clean(out.packageName)) out.bookingId = out.packageName;
    if (!clean(out.destination) && clean(out.hotelCity)) out.destination = out.hotelCity;
  }

  return out;
}

/** When switching to the booking tax template, enrich blanks — do not drop stored fields. */
export function travelForTemplateSwitch(
  _previousTemplate: string,
  nextTemplate: string,
  travel: TravelFormSlice
): TravelFormSlice {
  if (nextTemplate === BOOKING_TAX_TEMPLATE) {
    return coerceBookingTaxInput(travel);
  }
  return { ...travel };
}

/** Persist the full travel object; server normalizes without deleting keys. */
export function buildTravelPayload(template: string, travel: TravelFormSlice): TravelFormSlice {
  if (template === BOOKING_TAX_TEMPLATE) {
    return coerceBookingTaxInput(travel);
  }
  return { ...travel };
}
