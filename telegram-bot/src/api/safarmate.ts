import { config } from '../config.js';

export type ApiCompany = Record<string, unknown> & { _id: string; name?: string };
export type ApiCustomer = { _id: string; name: string; phone?: string; email?: string; city?: string };
export type ApiInvoice = Record<string, unknown> & { _id: string; template: string; number: string };

let cachedToken: string | null = null;

async function login(): Promise<string> {
  const res = await fetch(`${config.apiUrl}/api/auth/login`, {
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

async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${await token()}`);
  if (!headers.has('Content-Type') && init.body && typeof init.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }
  let res = await fetch(`${config.apiUrl}${path}`, { ...init, headers });
  if (res.status === 401) {
    cachedToken = null;
    headers.set('Authorization', `Bearer ${await token()}`);
    res = await fetch(`${config.apiUrl}${path}`, { ...init, headers });
  }
  return res;
}

export async function getCompany(): Promise<ApiCompany> {
  const res = await apiFetch('/api/company');
  if (!res.ok) throw new Error(`Company fetch failed (${res.status})`);
  const data = (await res.json()) as { company: ApiCompany };
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

export async function parseFlightPdf(base64: string, fileName: string): Promise<{
  draft: Record<string, unknown>;
  extraction?: { format: string };
}> {
  const res = await apiFetch('/api/flight-invoices/parse-pdf', {
    method: 'POST',
    body: JSON.stringify({
      fileName,
      mimeType: 'application/pdf',
      base64,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PDF parse failed (${res.status}): ${text.slice(0, 300)}`);
  }
  return (await res.json()) as { draft: Record<string, unknown>; extraction?: { format: string } };
}

export async function getInvoice(id: string): Promise<ApiInvoice> {
  const res = await apiFetch(`/api/invoices/${id}`);
  if (!res.ok) throw new Error(`Get invoice failed (${res.status})`);
  const data = (await res.json()) as { invoice: ApiInvoice };
  return data.invoice;
}
