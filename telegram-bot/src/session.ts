import type { FlightInvoiceDraft } from '../../server/src/utils/flightInvoiceDraft.js';

export type Flow = 'idle' | 'new_bill' | 'existing_bill';

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
  | 'customer_name'
  | 'customer_phone'
  | 'description'
  | 'amount'
  | 'booking_id'
  | 'destination'
  | 'booking_type'
  | 'confirm';

export interface NewBillDraft {
  templateId: string;
  templateName: string;
  customerName: string;
  customerPhone: string;
  description: string;
  amount: number;
  bookingId: string;
  destination: string;
  bookingType: 'hotel' | 'flight';
}

export interface ChatSession {
  flow: Flow;
  step?: NewBillStep;
  newBill?: Partial<NewBillDraft>;
  existingBillMode?: ExistingBillMode;
  groupTickets?: QueuedGroupTicket[];
  groupPnr?: string;
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
