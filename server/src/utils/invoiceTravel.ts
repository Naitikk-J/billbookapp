import type { InvoiceTemplateId } from '../config/invoiceTemplates';

export interface TravelDetailsInput {
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

export function normalizeTravelDetails(
  template: InvoiceTemplateId,
  raw: TravelDetailsInput | undefined,
  customer: CustomerTravelContext
): Record<string, unknown> {
  const td = raw ?? {};
  const bookingId = clean(td.bookingId) || clean(td.packageName);
  const hotelCity = clean(td.hotelCity) || clean(td.destination);
  const travellerName = clean(td.travellerName) || clean(customer.name);
  const travellerPan = clean(td.travellerPan) || clean(customer.panNumber);
  const panHolderName = clean(td.panHolderName) || travellerName.toUpperCase();
  const placeOfSupply =
    clean(td.placeOfSupply) || clean(customer.state) || '';
  const transactionalCategory =
    clean(td.transactionalCategory) ||
    (clean(customer.gstNumber) ? 'REG/B2B' : 'REG/B2C');
  const transactionalDetails = clean(td.transactionalDetails) || 'RG';
  const serviceDescription =
    clean(td.serviceDescription) ||
    (template === 'hotel-booking-tax'
      ? 'Reservation service for accommodation, tour operator and tourist assistance services'
      : '');

  return {
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
  };
}

export function validateTravelForTemplate(
  template: InvoiceTemplateId,
  travel: ReturnType<typeof normalizeTravelDetails>
): string | null {
  if (template !== 'hotel-booking-tax') return null;

  if (!clean(travel.hotel as string) && !clean(travel.packageName as string)) {
    return 'Hotel booking template requires a hotel name or package name.';
  }
  if (!travel.startDate) {
    return 'Hotel booking template requires a check-in date.';
  }
  if (!travel.endDate) {
    return 'Hotel booking template requires a check-out date.';
  }
  return null;
}
