export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
  companyId: string | null;
}

export interface Company {
  _id: string;
  name: string;
  legalName?: string;
  industry?: string;
  email?: string;
  phone?: string;
  website?: string;
  gstNumber?: string;
  panNumber?: string;
  cinNumber?: string;
  contactName?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  currency?: string;
  logoUrl?: string;
  signatureUrl?: string;
  stampUrl?: string;
  bankName?: string;
  beneficiaryName?: string;
  accountNumber?: string;
  accountType?: string;
  bankBranch?: string;
  ifsc?: string;
  upiId?: string;
  paymentQrUrl?: string;
  reminderContactsText?: string;
  reminderDisclaimer?: string;
  defaultTerms?: string;
  invoicePrefix?: string;
  quotePrefix?: string;
  geminiApiKey?: string;
  geminiApiKeySet?: boolean;
  gmailAddress?: string;
  gmailAppPassword?: string;
  gmailAppPasswordSet?: boolean;
  lastFlightSyncAt?: string | null;
}

export interface Customer {
  _id: string;
  companyId: string;
  name: string;
  email?: string;
  phone?: string;
  gstNumber?: string;
  panNumber?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  notes?: string;
  tags?: string[];
  kind?: 'customer' | 'supplier';
  openingBalance?: number;
  createdAt?: string;
  updatedAt?: string;
}

export type LedgerEntryKind = 'payment' | 'credit';
export type LedgerEntryMethod = 'cash' | 'upi' | 'bank' | 'card' | 'cheque' | 'other';

export interface LedgerEntry {
  _id: string;
  companyId: string;
  customerId: string;
  kind: LedgerEntryKind;
  amount: number;
  note?: string;
  method?: LedgerEntryMethod;
  date: string;
  createdAt?: string;
}

export interface LedgerAccount {
  _id: string;
  name: string;
  kind: 'customer' | 'supplier';
  phone?: string;
  email?: string;
  city?: string;
  balance: number;
  lastActivity?: string | null;
  lastReminderAt?: string | null;
}

export interface LedgerSummary {
  accounts: LedgerAccount[];
  totals: { netReceivable: number; netPayable: number; accountsCount: number };
}

export interface LedgerCustomerDetail {
  customer: LedgerAccount & { openingBalance: number };
  entries: LedgerEntry[];
  totals: { totalPayment: number; totalCredit: number; balance: number };
}

export interface Product {
  _id: string;
  companyId: string;
  kind: 'product' | 'service';
  name: string;
  description?: string;
  category?: string;
  unit?: string;
  price: number;
  taxPercent?: number;
  hsnCode?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface InvoiceLineItem {
  description: string;
  hsnCode?: string;
  quantity: number;
  unit?: string;
  rate: number;
  taxPercent?: number;
  discountPercent?: number;
  amount?: number;
  taxableValue?: number;
  taxAmount?: number;
}

export interface CustomerSnapshot {
  name?: string;
  email?: string;
  phone?: string;
  gstNumber?: string;
  panNumber?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
}

export interface FlightInvoiceDraft {
  template: string;
  kind: InvoiceKind;
  currency: string;
  taxMode: 'intra' | 'inter' | 'none';
  customerHint: {
    name: string;
    phone: string;
    email: string;
    gstNumber: string;
    city: string;
  };
  matchedCustomerId: string | null;
  travelDetails: TravelDetails;
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
  /** PNG data URLs sliced from the uploaded ticket PDF */
  barcodeSnapshots?: string[];
  segments: Array<{
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
  }>;
}

export interface TravelDetails {
  bookingType?: 'hotel' | 'flight';
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
  flightSegments?: Array<{
    pnr?: string;
    flightNumber?: string;
    airline?: string;
    fromCity?: string;
    fromAirport?: string;
    toCity?: string;
    toAirport?: string;
    departureAt?: string | null;
    arrivalAt?: string | null;
    passengers?: Array<{ name: string; seat?: string; cabin?: string }>;
  }>;
  barcodeSnapshots?: string[];
}

export interface Payment {
  _id?: string;
  amount: number;
  paidAt?: string;
  method: 'upi' | 'bank_transfer' | 'cash' | 'cheque' | 'credit_card' | 'debit_card' | 'other';
  reference?: string;
  note?: string;
}

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'partial' | 'overdue' | 'cancelled';
export type InvoiceKind = 'invoice' | 'quote' | 'proforma' | 'receipt';

export interface Invoice {
  _id: string;
  companyId: string;
  customerId: string;
  kind: InvoiceKind;
  number: string;
  issueDate: string;
  dueDate?: string;
  currency: string;
  template: string;
  customerSnapshot: CustomerSnapshot;
  items: InvoiceLineItem[];
  travelDetails?: TravelDetails;
  notes?: string;
  terms?: string;
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  cgstTotal: number;
  sgstTotal: number;
  igstTotal: number;
  grandTotal: number;
  amountPaid: number;
  balanceDue: number;
  taxMode: 'intra' | 'inter' | 'none';
  status: InvoiceStatus;
  payments: Payment[];
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export type FlightStatus =
  | 'booked'
  | 'confirmed'
  | 'checked_in'
  | 'boarding'
  | 'delayed'
  | 'departed'
  | 'arrived'
  | 'cancelled'
  | 'missed';

export const FLIGHT_STATUSES: FlightStatus[] = [
  'booked',
  'confirmed',
  'checked_in',
  'boarding',
  'delayed',
  'departed',
  'arrived',
  'cancelled',
  'missed',
];

export interface FlightPassenger {
  name: string;
  seat?: string;
  cabin?: string;
}

export interface FlightHistoryEntry {
  at: string;
  kind: string;
  message: string;
}

export interface Flight {
  _id: string;
  companyId: string;
  customerId?: string | null;

  pnr: string;
  bookingReference?: string;
  airline?: string;
  airlineCode?: string;
  flightNumber?: string;

  fromCity?: string;
  fromAirport?: string;
  fromTerminal?: string;
  toCity?: string;
  toAirport?: string;
  toTerminal?: string;

  departureAt?: string | null;
  arrivalAt?: string | null;
  durationMinutes?: number | null;

  passengers: FlightPassenger[];
  cabinClass?: string;

  status: FlightStatus;
  statusNote?: string;
  position: number;

  source: 'manual' | 'email' | 'pdf';
  sourceRef?: string;
  emailSubject?: string;
  emailFrom?: string;
  emailDate?: string | null;
  rawSnippet?: string;
  lastEmailAt?: string | null;
  pdfName?: string;

  notes?: string;
  color?: string;
  tags?: string[];

  history?: FlightHistoryEntry[];
  createdAt?: string;
  updatedAt?: string;
}

export interface FlightBoard {
  flights: Flight[];
  board: Record<FlightStatus, Flight[]>;
}

export interface FlightSyncSummary {
  scanned: number;
  parsed: number;
  created: number;
  updated: number;
  skipped: number;
}

export interface FlightSyncResult {
  summary: FlightSyncSummary;
  errors: string[];
  lastFlightSyncAt: string | null;
  hasMore: boolean;
  nextSince: string | null;
  elapsedMs?: number;
}

export type WhatsAppBridgeState =
  | 'initializing'
  | 'qr'
  | 'authenticated'
  | 'ready'
  | 'disconnected'
  | 'auth_failure';

export interface WhatsAppBridgeStatus {
  state: WhatsAppBridgeState;
  ready: boolean;
  qrDataUrl: string | null;
  qrIssuedAt: string | null;
  message: string;
  account: { number: string; name: string } | null;
}

export interface WhatsAppStatusResponse {
  configured: boolean;
  reason?: string;
  unreachable?: boolean;
  status: WhatsAppBridgeStatus | null;
}

export interface ReminderResult {
  ok: true;
  messageId: string;
  sentAt: string;
  message: string;
  to: string;
  balance: number;
}

export interface DashboardStats {
  today: { revenue: number };
  month: { revenue: number; count: number };
  pending: { total: number; count: number };
  paidCount: number;
  byStatus: Record<string, number>;
  monthly: { year: number; month: number; revenue: number; received: number }[];
}
