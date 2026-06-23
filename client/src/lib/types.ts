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
  accountNumber?: string;
  ifsc?: string;
  upiId?: string;
  defaultTerms?: string;
  invoicePrefix?: string;
  quotePrefix?: string;
}

export interface Customer {
  _id: string;
  companyId: string;
  name: string;
  email?: string;
  phone?: string;
  gstNumber?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  notes?: string;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
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
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
}

export interface TravelDetails {
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

export interface DashboardStats {
  today: { revenue: number };
  month: { revenue: number; count: number };
  pending: { total: number; count: number };
  paidCount: number;
  byStatus: Record<string, number>;
  monthly: { year: number; month: number; revenue: number; received: number }[];
}
