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

const EMPTY_TRAVEL: TravelFormSlice = {
  bookingType: 'hotel',
  packageName: '',
  destination: '',
  startDate: '',
  endDate: '',
  adults: 0,
  children: 0,
  hotel: '',
  flight: '',
  vehicle: '',
  bookingId: '',
  hotelCity: '',
  travellerName: '',
  travellerPan: '',
  panHolderName: '',
  advancedReceiptVoucherNo: '',
  placeOfSupply: '',
  transactionalCategory: '',
  transactionalDetails: 'RG',
  serviceDescription: '',
};

function blankGeneralTravel(from: TravelFormSlice): TravelFormSlice {
  return {
    ...EMPTY_TRAVEL,
    packageName: from.packageName ?? '',
    destination: from.destination ?? '',
    startDate: from.startDate ?? '',
    endDate: from.endDate ?? '',
    adults: from.adults ?? 0,
    children: from.children ?? 0,
    hotel: from.hotel ?? '',
    flight: from.flight ?? '',
    vehicle: from.vehicle ?? '',
  };
}

function blankBookingTravel(from: TravelFormSlice, bookingType: BookingType): TravelFormSlice {
  const coerced = coerceBookingTaxInput({ ...from, bookingType });
  const base: TravelFormSlice = {
    bookingType,
    bookingId: coerced.bookingId ?? '',
    startDate: coerced.startDate ?? '',
    endDate: coerced.endDate ?? '',
    travellerName: coerced.travellerName ?? '',
    travellerPan: coerced.travellerPan ?? '',
    panHolderName: coerced.panHolderName ?? '',
    advancedReceiptVoucherNo: coerced.advancedReceiptVoucherNo ?? '',
    placeOfSupply: coerced.placeOfSupply ?? '',
    transactionalCategory: coerced.transactionalCategory ?? '',
    transactionalDetails: coerced.transactionalDetails ?? 'RG',
    serviceDescription: coerced.serviceDescription ?? '',
  };

  if (bookingType === 'flight') {
    return {
      ...base,
      flight: coerced.flight ?? '',
      destination: coerced.destination ?? '',
    };
  }

  return {
    ...base,
    hotel: coerced.hotel ?? '',
    hotelCity: coerced.hotelCity ?? '',
  };
}

/** Re-shape travel fields when the user picks a different PDF template. */
export function travelForTemplateSwitch(
  previousTemplate: string,
  nextTemplate: string,
  travel: TravelFormSlice
): TravelFormSlice {
  if (nextTemplate === BOOKING_TAX_TEMPLATE) {
    const bookingType = inferBookingType(travel);
    return blankBookingTravel(travel, bookingType);
  }

  if (previousTemplate === BOOKING_TAX_TEMPLATE) {
    const coerced = coerceBookingTaxInput(travel);
    const bookingType = inferBookingType(coerced);
    return blankGeneralTravel({
      packageName:
        bookingType === 'hotel'
          ? coerced.hotel || coerced.packageName || ''
          : coerced.bookingId || coerced.packageName || '',
      destination: coerced.destination || coerced.hotelCity || '',
      startDate: coerced.startDate,
      endDate: coerced.endDate,
      adults: travel.adults ?? 0,
      children: travel.children ?? 0,
      hotel: bookingType === 'hotel' ? coerced.hotel : '',
      flight: bookingType === 'flight' ? coerced.flight : '',
      vehicle: travel.vehicle ?? '',
    });
  }

  return travel;
}

export function buildTravelPayload(template: string, travel: TravelFormSlice): TravelFormSlice {
  if (template === BOOKING_TAX_TEMPLATE) {
    const bookingType = inferBookingType(travel);
    return blankBookingTravel(travel, bookingType);
  }
  return blankGeneralTravel(travel);
}

export function resolveBookingTypeForDisplay(td: TravelFormSlice | undefined): BookingType {
  return inferBookingType(td);
}
