import type { FlightInvoiceDraft } from '../../server/src/utils/flightInvoiceDraft.js';

export type Flow =
  | 'idle'
  | 'new_bill'
  | 'existing_bill'
  | 'ledger'
  | 'invoices'
  | 'customers'
  | 'products'
  | 'flights';

/** One PDF = one passenger ticket under the same PNR. */
export type ExistingBillMode = 'single' | 'group_pnr';

export interface QueuedGroupTicket {
  fileName: string;
  draft: FlightInvoiceDraft;
  extractionFormat: string;
  barcodeCount: number;
}

export type NewBillStep =
  | 'template'
  | 'kind'
  | 'customer_name'
  | 'customer_phone'
  | 'customer_email'
  | 'customer_city'
  | 'customer_gst'
  | 'tax_mode'
  | 'issue_date'
  | 'due_date'
  | 'item_desc'
  | 'item_hsn'
  | 'item_qty'
  | 'item_unit'
  | 'item_rate'
  | 'item_tax'
  | 'item_discount'
  | 'more_items'
  | 'booking_type'
  | 'booking_id'
  | 'voucher_no'
  | 'flight'
  | 'hotel'
  | 'hotel_city'
  | 'destination'
  | 'package_name'
  | 'start_date'
  | 'end_date'
  | 'adults'
  | 'children'
  | 'vehicle'
  | 'place_of_supply'
  | 'service_desc'
  | 'traveller_name'
  | 'traveller_pan'
  | 'pan_holder'
  | 'txn_category'
  | 'txn_details'
  | 'notes'
  | 'terms'
  | 'confirm';

export interface BillLine {
  description: string;
  hsnCode: string;
  quantity: number;
  unit: string;
  rate: number;
  taxPercent: number;
  discountPercent: number;
}

export interface NewBillDraft {
  templateId: string;
  templateName: string;
  kind: 'invoice' | 'quote' | 'proforma' | 'receipt';
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  customerCity: string;
  customerGst: string;
  taxMode: 'intra' | 'inter' | 'none';
  issueDate: string;
  dueDate: string;
  items: BillLine[];
  scratch: Partial<BillLine>;
  bookingType: 'hotel' | 'flight';
  bookingId: string;
  voucherNo: string;
  flight: string;
  hotel: string;
  hotelCity: string;
  destination: string;
  packageName: string;
  startDate: string;
  endDate: string;
  placeOfSupply: string;
  serviceDescription: string;
  travellerName: string;
  travellerPan: string;
  panHolderName: string;
  txnCategory: string;
  txnDetails: string;
  adults: number;
  children: number;
  vehicle: string;
  notes: string;
  terms: string;
  description: string;
  amount: number;
}

export type PendingDelete = {
  kind: 'invoice' | 'customer' | 'ledger' | 'product' | 'flight';
  id: string;
  label: string;
};

export type LedgerForm = {
  step: 'search' | 'amount' | 'method' | 'note';
  customerId?: string;
  customerName?: string;
  entryKind?: 'payment' | 'credit';
  amount?: number;
  method?: string;
};

export type PayForm = {
  step: 'search' | 'amount' | 'method' | 'note';
  invoiceId?: string;
  invoiceLabel?: string;
  amount?: number;
  method?: string;
};

export type ProductForm = {
  step: 'name' | 'price' | 'tax' | 'hsn';
  name?: string;
  price?: number;
  taxPercent?: number;
};

export interface ChatSession {
  flow: Flow;
  step?: NewBillStep;
  newBill?: Partial<NewBillDraft>;
  existingBillMode?: ExistingBillMode;
  groupTickets?: QueuedGroupTicket[];
  groupPnr?: string;
  pendingDelete?: PendingDelete;
  ledger?: LedgerForm;
  pay?: PayForm;
  product?: ProductForm;
}

const sessions = new Map<number, ChatSession>();

export function getSession(chatId: number): ChatSession {
  let s = sessions.get(chatId);
  if (!s) {
    s = { flow: 'idle' };
    sessions.set(chatId, s);
  }
  return s;
}

export function resetSession(chatId: number): void {
  sessions.set(chatId, { flow: 'idle' });
}
