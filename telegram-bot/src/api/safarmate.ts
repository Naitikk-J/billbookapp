import { config } from '../config.js';
import { fetchWithRetry } from '../http.js';

export type ApiCompany = Record<string, unknown> & { _id: string; name?: string };
export type ApiCustomer = {
  _id: string;
  name: string;
  phone?: string;
  email?: string;
  city?: string;
  gstNumber?: string;
  kind?: string;
};
export type ApiInvoice = Record<string, unknown> & { _id: string; template: string; number: string };

let cachedToken: string | null = null;
let cachedCompany: ApiCompany | null = null;
let companyCachedAt = 0;
const COMPANY_TTL_MS = 5 * 60_000;

async function login(): Promise<string> {
  const res = await fetchWithRetry(`${config.apiUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: config.email, password: config.password }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Safarmate login failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const data = (await res.json()) as { accessToken: string };
  cachedToken = data.accessToken;
  return cachedToken;
}

async function token(): Promise<string> {
  if (cachedToken) return cachedToken;
  return login();
}

export async function warmApiSession(): Promise<void> {
  await token();
}

async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${await token()}`);
  if (!headers.has('Content-Type') && init.body && typeof init.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }
  let res = await fetchWithRetry(`${config.apiUrl}${path}`, { ...init, headers });
  if (res.status === 401) {
    cachedToken = null;
    headers.set('Authorization', `Bearer ${await token()}`);
    res = await fetchWithRetry(`${config.apiUrl}${path}`, { ...init, headers });
  }
  return res;
}

export async function getCompany(): Promise<ApiCompany> {
  if (cachedCompany && Date.now() - companyCachedAt < COMPANY_TTL_MS) {
    return cachedCompany;
  }
  const res = await apiFetch('/api/company');
  if (!res.ok) throw new Error(`Company fetch failed (${res.status})`);
  const data = (await res.json()) as { company: ApiCompany };
  cachedCompany = data.company;
  companyCachedAt = Date.now();
  return data.company;
}

async function apiJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await apiFetch(path, init);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${init.method ?? 'GET'} ${path} failed (${res.status}): ${text.slice(0, 240)}`);
  }
  return (await res.json()) as T;
}

export async function createCustomer(input: {
  name: string;
  phone?: string;
  email?: string;
  city?: string;
  gstNumber?: string;
}): Promise<ApiCustomer> {
  const data = await apiJson<{ customer: ApiCustomer }>('/api/customers', {
    method: 'POST',
    body: JSON.stringify({
      name: input.name,
      phone: input.phone ?? '',
      email: input.email ?? '',
      city: input.city ?? '',
      gstNumber: input.gstNumber ?? '',
    }),
  });
  return data.customer;
}

export async function listCustomers(q = ''): Promise<ApiCustomer[]> {
  const qs = q ? `?q=${encodeURIComponent(q)}` : '';
  const data = await apiJson<{ customers: ApiCustomer[] }>(`/api/customers${qs}`);
  return data.customers ?? [];
}

export async function patchCustomer(id: string, body: Record<string, unknown>): Promise<ApiCustomer> {
  const data = await apiJson<{ customer: ApiCustomer }>(`/api/customers/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  return data.customer;
}

export async function deleteCustomer(id: string): Promise<void> {
  await apiJson(`/api/customers/${id}`, { method: 'DELETE' });
}

export async function findOrCreateCustomer(input: {
  name: string;
  phone?: string;
  email?: string;
  city?: string;
  gstNumber?: string;
}): Promise<{ customer: ApiCustomer; created: boolean }> {
  const matches = await listCustomers(input.name);
  const exact = matches.find((c) => c.name.trim().toLowerCase() === input.name.trim().toLowerCase());
  if (exact) {
    const patch: Record<string, string> = {};
    if (input.phone && !exact.phone) patch.phone = input.phone;
    if (input.email && !exact.email) patch.email = input.email;
    if (input.city && !exact.city) patch.city = input.city;
    if (input.gstNumber && !exact.gstNumber) patch.gstNumber = input.gstNumber;
    if (Object.keys(patch).length > 0) {
      return { customer: await patchCustomer(exact._id, patch), created: false };
    }
    return { customer: exact, created: false };
  }
  return { customer: await createCustomer(input), created: true };
}

export async function createInvoice(body: Record<string, unknown>): Promise<ApiInvoice> {
  const data = await apiJson<{ invoice: ApiInvoice }>('/api/invoices', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return data.invoice;
}

export type InvoiceListItem = {
  _id: string;
  number?: string;
  status?: string;
  kind?: string;
  grandTotal?: number;
  balanceDue?: number;
  amountPaid?: number;
  template?: string;
  customerSnapshot?: { name?: string };
  travelDetails?: { destination?: string; bookingId?: string };
};

export async function listInvoices(q = '', limit = 8): Promise<InvoiceListItem[]> {
  const params = new URLSearchParams({ view: 'summary', limit: String(limit) });
  if (q) params.set('q', q);
  const data = await apiJson<{ invoices: InvoiceListItem[] }>(`/api/invoices?${params}`);
  return data.invoices ?? [];
}

export async function getInvoice(id: string): Promise<ApiInvoice> {
  const data = await apiJson<{ invoice: ApiInvoice }>(`/api/invoices/${id}`);
  return data.invoice;
}

export async function deleteInvoice(id: string): Promise<void> {
  await apiJson(`/api/invoices/${id}`, { method: 'DELETE' });
}

export async function addInvoicePayment(
  id: string,
  body: { amount: number; method: string; note?: string; reference?: string }
): Promise<ApiInvoice> {
  const data = await apiJson<{ invoice: ApiInvoice }>(`/api/invoices/${id}/payments`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return data.invoice;
}

export async function invoiceStats(): Promise<{
  today: { revenue: number };
  month: { revenue: number; count: number };
  pending: { total: number; count: number };
  paidCount: number;
}> {
  return apiJson('/api/invoices/stats');
}

export type LedgerAccount = {
  _id: string;
  name: string;
  phone?: string;
  balance: number;
  kind?: string;
};

export async function ledgerSummary(): Promise<{
  accounts: LedgerAccount[];
  totals: { netReceivable: number; netPayable: number; accountsCount: number };
}> {
  return apiJson('/api/ledger/summary');
}

export type LedgerEntryRow = {
  _id: string;
  kind: 'payment' | 'credit';
  amount: number;
  note?: string;
  method?: string;
  date?: string;
};

export async function ledgerDetail(customerId: string): Promise<{
  customer: { _id: string; name: string; phone?: string; openingBalance?: number };
  entries: LedgerEntryRow[];
  totals: { totalPayment: number; totalCredit: number; balance: number };
}> {
  return apiJson(`/api/ledger/${customerId}`);
}

export async function addLedgerEntry(
  customerId: string,
  body: { kind: 'payment' | 'credit'; amount: number; method?: string; note?: string }
): Promise<void> {
  await apiJson(`/api/ledger/${customerId}/entries`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function deleteLedgerEntry(id: string): Promise<void> {
  await apiJson(`/api/ledger/entries/${id}`, { method: 'DELETE' });
}

export type ApiProduct = {
  _id: string;
  name: string;
  price: number;
  taxPercent?: number;
  hsnCode?: string;
  unit?: string;
};

export async function listProducts(q = ''): Promise<ApiProduct[]> {
  const qs = q ? `?q=${encodeURIComponent(q)}` : '';
  const data = await apiJson<{ products: ApiProduct[] }>(`/api/products${qs}`);
  return data.products ?? [];
}

export async function createProduct(body: {
  name: string;
  price: number;
  taxPercent?: number;
  hsnCode?: string;
  unit?: string;
}): Promise<ApiProduct> {
  const data = await apiJson<{ product: ApiProduct }>('/api/products', {
    method: 'POST',
    body: JSON.stringify({ kind: 'service', unit: 'pax', ...body }),
  });
  return data.product;
}

export async function deleteProduct(id: string): Promise<void> {
  await apiJson(`/api/products/${id}`, { method: 'DELETE' });
}

export type ApiFlight = {
  _id: string;
  pnr?: string;
  airline?: string;
  flightNumber?: string;
  fromAirport?: string;
  toAirport?: string;
  status?: string;
  passengers?: Array<{ name?: string }>;
};

export async function listFlights(): Promise<ApiFlight[]> {
  const data = await apiJson<{ flights: ApiFlight[] }>('/api/flights');
  return data.flights ?? [];
}

export async function patchFlight(id: string, body: { status: string }): Promise<void> {
  await apiJson(`/api/flights/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
}

export async function deleteFlight(id: string): Promise<void> {
  await apiJson(`/api/flights/${id}`, { method: 'DELETE' });
}

function draftToInvoiceBody(draft: Record<string, unknown>, customerId: string) {
  const travel = (draft.travelDetails ?? {}) as Record<string, unknown>;
  const segments = draft.segments as unknown[] | undefined;
  return {
    kind: draft.kind ?? 'invoice',
    customerId,
    currency: draft.currency ?? 'INR',
    template: draft.template ?? 'safarmate-flight-voucher',
    taxMode: draft.taxMode ?? 'none',
    status: 'sent',
    issueDate: new Date().toISOString(),
    notes: draft.notes ?? '',
    items: draft.items ?? [],
    travelDetails: {
      ...travel,
      flightSegments: segments ?? travel.flightSegments,
    },
  };
}

async function saveFlightDraftLegacy(draft: Record<string, unknown>): Promise<ApiInvoice> {
  const hint = (draft.customerHint ?? {}) as {
    name?: string;
    phone?: string;
    email?: string;
    city?: string;
  };
  const customer = await createCustomer({
    name: (hint.name ?? '').trim() || 'Flight customer',
    phone: hint.phone,
    email: hint.email,
    city: hint.city,
  });
  return createInvoice(draftToInvoiceBody(draft, customer._id));
}

/** Save flight draft — prefers one-shot API; falls back if server not updated yet. */
export async function saveFlightDraft(draft: Record<string, unknown>): Promise<ApiInvoice> {
  const res = await apiFetch('/api/flight-invoices/commit-draft', {
    method: 'POST',
    body: JSON.stringify({ draft, status: 'sent' }),
  });
  if (res.ok) {
    const data = (await res.json()) as { invoice: ApiInvoice };
    return data.invoice;
  }
  if (res.status === 404 || res.status === 405) {
    return saveFlightDraftLegacy(draft);
  }
  const text = await res.text();
  throw new Error(`Save bill failed (${res.status}): ${text.slice(0, 300)}`);
}
