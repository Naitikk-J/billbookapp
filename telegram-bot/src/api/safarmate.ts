import { config } from '../config.js';
import { fetchWithRetry } from '../http.js';

export type ApiCompany = Record<string, unknown> & { _id: string; name?: string };
export type ApiCustomer = { _id: string; name: string; phone?: string; email?: string; city?: string };
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

export async function createCustomer(input: {
  name: string;
  phone?: string;
  email?: string;
  city?: string;
}): Promise<ApiCustomer> {
  const res = await apiFetch('/api/customers', {
    method: 'POST',
    body: JSON.stringify({
      name: input.name,
      phone: input.phone ?? '',
      email: input.email ?? '',
      city: input.city ?? '',
    }),
  });
  if (!res.ok) throw new Error(`Create customer failed (${res.status})`);
  const data = (await res.json()) as { customer: ApiCustomer };
  return data.customer;
}

export async function createInvoice(body: Record<string, unknown>): Promise<ApiInvoice> {
  const res = await apiFetch('/api/invoices', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Create invoice failed (${res.status}): ${text.slice(0, 300)}`);
  }
  const data = (await res.json()) as { invoice: ApiInvoice };
  return data.invoice;
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
