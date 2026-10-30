import type { NewBillDraft, NewBillStep } from './session.js';

const GST_TEMPLATES = new Set(['safarmate-tax', 'hotel-booking-tax']);

export function defaultHsn(templateId: string): string {
  return GST_TEMPLATES.has(templateId) ? '998552' : '';
}

export function blankDraft(
  templateId: string,
  templateName: string,
  bookingType: 'hotel' | 'flight'
): Partial<NewBillDraft> {
  return {
    templateId,
    templateName,
    kind: 'invoice',
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    customerCity: '',
    customerGst: '',
    taxMode: GST_TEMPLATES.has(templateId) ? 'intra' : 'none',
    issueDate: '',
    dueDate: '',
    items: [],
    scratch: {},
    bookingType,
    bookingId: '',
    voucherNo: '',
    flight: '',
    hotel: '',
    hotelCity: '',
    destination: '',
    packageName: '',
    startDate: '',
    endDate: '',
    placeOfSupply: '',
    serviceDescription: '',
    travellerName: '',
    travellerPan: '',
    panHolderName: '',
    txnCategory: '',
    txnDetails: '',
    adults: 0,
    children: 0,
    vehicle: '',
    notes: '',
    terms: '',
    description: '',
    amount: 0,
  };
}

export function tailSteps(draft: Partial<NewBillDraft>): NewBillStep[] {
  const id = draft.templateId ?? '';
  if (id === 'hotel-booking-tax') {
    const stay: NewBillStep[] =
      draft.bookingType === 'flight'
        ? ['flight', 'destination', 'start_date', 'end_date']
        : ['hotel', 'hotel_city', 'start_date', 'end_date'];
    return [
      'booking_type',
      'booking_id',
      'voucher_no',
      ...stay,
      'place_of_supply',
      'service_desc',
      'traveller_name',
      'traveller_pan',
      'pan_holder',
      'txn_category',
      'txn_details',
      'notes',
      'terms',
      'confirm',
    ];
  }
  if (id === 'safarmate-flight-voucher') {
    return ['booking_id', 'flight', 'destination', 'start_date', 'end_date', 'traveller_name', 'notes', 'terms', 'confirm'];
  }
  return [
    'package_name',
    'destination',
    'start_date',
    'end_date',
    'adults',
    'children',
    'hotel',
    'flight',
    'vehicle',
    'notes',
    'terms',
    'confirm',
  ];
}

export const PROMPTS: Record<string, string> = {
  customer_phone: 'Phone? (- to skip)',
  customer_email: 'Email? (- to skip)',
  customer_city: 'City? (- to skip)',
  customer_gst: 'Customer GSTIN? (- to skip)',
  issue_date: 'Issue date? DD/MM/YYYY or - for today',
  due_date: 'Due date? DD/MM/YYYY or - to skip',
  item_desc: 'Line 1 — description? (what you write in the bill row)',
  item_hsn: 'HSN / SAC? (- uses 998552 on tax templates, else blank)',
  item_qty: 'Quantity? (number, default 1 if you send -)',
  item_unit: 'Unit? (pax / nos / night — or - for pax)',
  item_rate: 'Rate in INR? (per unit)',
  item_tax: 'Tax %? (e.g. 18, 5, or 0)',
  item_discount: 'Discount %? (- for 0)',
  booking_id: 'Booking ID / PNR? (- to skip)',
  voucher_no: 'Advanced receipt voucher no.? (- to skip)',
  flight: 'Flight / airline + route? (- to skip)',
  hotel: 'Hotel name? (- to skip)',
  hotel_city: 'Hotel city? (- to skip)',
  destination: 'Destination / sector? (- to skip)',
  package_name: 'Package name? (- to skip)',
  start_date: 'Start / departure / check-in? DD/MM/YYYY or -',
  end_date: 'End / return / check-out? DD/MM/YYYY or -',
  adults: 'Adults? (number or -)',
  children: 'Children? (number or -)',
  vehicle: 'Vehicle / transfers? (- to skip)',
  place_of_supply: 'Place of supply? (- to skip)',
  service_desc: 'Service description? (- to skip)',
  traveller_name: 'Traveller name? (- uses customer name)',
  traveller_pan: 'Traveller PAN? (- to skip)',
  pan_holder: 'PAN holder name? (- to skip)',
  txn_category: 'Txn category? (e.g. REG/B2C, or -)',
  txn_details: 'Txn details? (- uses RG)',
  notes: 'Notes for the customer? (- to skip)',
  terms: 'Terms & conditions? (- to skip)',
};

export function summaryText(draft: NewBillDraft): string {
  const lines = (draft.items ?? []).map(
    (it, i) => `${i + 1}. ${it.description} · ${it.quantity} ${it.unit} × ₹${it.rate} · tax ${it.taxPercent}%`
  );
  const travel = [
    draft.bookingId && `PNR/Booking: ${draft.bookingId}`,
    draft.packageName && `Package: ${draft.packageName}`,
    draft.destination && `Destination: ${draft.destination}`,
    draft.hotel && `Hotel: ${draft.hotel}`,
    draft.flight && `Flight: ${draft.flight}`,
    draft.travellerName && `Traveller: ${draft.travellerName}`,
    draft.placeOfSupply && `Place of supply: ${draft.placeOfSupply}`,
  ].filter(Boolean);
  return [
    `Template: ${draft.templateName}`,
    `Type: ${draft.kind}`,
    `Customer: ${draft.customerName}`,
    draft.customerPhone && `Phone: ${draft.customerPhone}`,
    draft.customerEmail && `Email: ${draft.customerEmail}`,
    draft.customerCity && `City: ${draft.customerCity}`,
    draft.customerGst && `GST: ${draft.customerGst}`,
    `Tax: ${draft.taxMode}`,
    'Lines:',
    ...lines,
    ...travel,
    draft.notes && `Notes: ${draft.notes}`,
  ]
    .filter(Boolean)
    .join('\n');
}

export const PRE_ITEM: NewBillStep[] = [
  'kind',
  'customer_name',
  'customer_phone',
  'customer_email',
  'customer_city',
  'customer_gst',
  'tax_mode',
  'issue_date',
  'due_date',
  'item_desc',
];

export function nextLinear(draft: Partial<NewBillDraft>, step: NewBillStep): NewBillStep {
  if (PRE_ITEM.includes(step)) {
    return PRE_ITEM[PRE_ITEM.indexOf(step) + 1] ?? 'item_desc';
  }
  const tail = tailSteps(draft);
  const i = tail.indexOf(step);
  if (i >= 0 && tail[i + 1]) return tail[i + 1]!;
  return 'confirm';
}
