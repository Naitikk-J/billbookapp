import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { store } from '@/store';
import { setTokens, signOut } from '@/store/authSlice';

const baseURL = import.meta.env.VITE_API_URL ?? '/api';

export const api = axios.create({
  baseURL,
  withCredentials: false,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = store.getState().auth.accessToken;
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshing: Promise<string | null> | null = null;

async function attemptRefresh(): Promise<string | null> {
  const refreshToken = store.getState().auth.refreshToken;
  if (!refreshToken) return null;
  try {
    const res = await axios.post(`${baseURL}/auth/refresh`, { refreshToken });
    const accessToken = res.data?.accessToken as string | undefined;
    if (!accessToken) return null;
    const current = store.getState().auth;
    store.dispatch(
      setTokens({
        accessToken,
        refreshToken: current.refreshToken!,
        user: current.user!,
      })
    );
    return accessToken;
  } catch {
    return null;
  }
}

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    if (
      error.response?.status === 401 &&
      original &&
      !original._retry &&
      !original.url?.includes('/auth/')
    ) {
      original._retry = true;
      if (!refreshing) refreshing = attemptRefresh();
      const newToken = await refreshing;
      refreshing = null;
      if (newToken) {
        original.headers = original.headers ?? {};
        (original.headers as Record<string, string>).Authorization = `Bearer ${newToken}`;
        return api.request(original);
      }
      store.dispatch(signOut());
    }
    return Promise.reject(error);
  }
);

interface ApiErrorPayload {
  error?: {
    message?: string;
    details?: {
      fields?: Array<{ path?: string; message?: string }>;
      fieldErrors?: Record<string, string[]>;
      formErrors?: string[];
    } | null;
  };
}

const FIELD_LABELS: Record<string, string> = {
  customerId: 'Customer',
  items: 'Line items',
  issueDate: 'Issue date',
  dueDate: 'Due date',
  notes: 'Notes',
  terms: 'Terms',
  taxMode: 'Tax mode',
  travelDetails: 'Travel details',
  description: 'description',
  quantity: 'quantity',
  rate: 'rate',
  taxPercent: 'tax %',
  discountPercent: 'discount %',
  unit: 'unit',
  hsnCode: 'HSN code',
};

function humanizePath(path: string): string {
  if (!path) return '';
  return path
    .split('.')
    .map((seg) => {
      if (/^\d+$/.test(seg)) return `#${Number(seg) + 1}`;
      return FIELD_LABELS[seg] ?? seg;
    })
    .join(' → ');
}

export function apiError(err: unknown, fallback = 'Something went wrong'): string {
  if (!axios.isAxiosError(err)) {
    if (err instanceof Error) return err.message;
    return fallback;
  }

  const payload = err.response?.data as ApiErrorPayload | undefined;
  const baseMessage = payload?.error?.message ?? err.message ?? fallback;

  const fields = payload?.error?.details?.fields ?? [];
  if (fields.length > 0) {
    const parts = fields
      .slice(0, 3)
      .map((f) => {
        const label = humanizePath(f.path ?? '');
        return label ? `${label}: ${f.message ?? 'invalid'}` : (f.message ?? 'invalid');
      })
      .filter(Boolean);
    const more = fields.length > parts.length ? ` (+${fields.length - parts.length} more)` : '';
    if (parts.length > 0) {
      return `${baseMessage.replace(/ —.*$/, '')} — ${parts.join('; ')}${more}`;
    }
  }

  const flatFieldErrors = payload?.error?.details?.fieldErrors;
  if (flatFieldErrors && Object.keys(flatFieldErrors).length > 0) {
    const parts = Object.entries(flatFieldErrors)
      .slice(0, 3)
      .map(([k, msgs]) => `${humanizePath(k)}: ${(msgs ?? []).join(', ') || 'invalid'}`);
    return `${baseMessage} — ${parts.join('; ')}`;
  }

  return baseMessage;
}
