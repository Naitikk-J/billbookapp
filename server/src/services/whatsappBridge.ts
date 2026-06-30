import { env } from '../config/env';
import { ApiError } from '../utils/ApiError';

export type WhatsAppState =
  | 'initializing'
  | 'qr'
  | 'authenticated'
  | 'ready'
  | 'disconnected'
  | 'auth_failure';

export interface WhatsAppStatus {
  state: WhatsAppState;
  ready: boolean;
  qrDataUrl: string | null;
  qrIssuedAt: string | null;
  message: string;
  account: { number: string; name: string } | null;
}

export interface WhatsAppConfigStatus {
  configured: boolean;
  reason?: string;
}

export function getConfigStatus(): WhatsAppConfigStatus {
  if (!env.whatsappBridgeUrl) {
    return {
      configured: false,
      reason:
        'WhatsApp bridge is not configured on the server (set WHATSAPP_BRIDGE_URL).',
    };
  }
  if (!env.whatsappBridgeToken) {
    return {
      configured: false,
      reason:
        'WhatsApp bridge token is missing on the server (set WHATSAPP_BRIDGE_TOKEN).',
    };
  }
  return { configured: true };
}

async function bridgeFetch<T>(
  path: string,
  init: { method: 'GET' | 'POST'; body?: unknown } = { method: 'GET' }
): Promise<T> {
  const cfg = getConfigStatus();
  if (!cfg.configured) {
    throw ApiError.badRequest(cfg.reason ?? 'WhatsApp bridge not configured');
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const res = await fetch(`${env.whatsappBridgeUrl}${path}`, {
      method: init.method,
      headers: {
        Authorization: `Bearer ${env.whatsappBridgeToken}`,
        'Content-Type': 'application/json',
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
      signal: controller.signal,
    });
    if (!res.ok) {
      let detail = '';
      try {
        const data = (await res.json()) as { error?: { message?: string } };
        detail = data?.error?.message ?? '';
      } catch {
        // ignore
      }
      throw new Error(detail || `Bridge responded with ${res.status}`);
    }
    return (await res.json()) as T;
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw ApiError.badRequest('WhatsApp bridge timed out. Is the service running?');
    }
    const message = err instanceof Error ? err.message : String(err);
    throw ApiError.badRequest(`WhatsApp bridge: ${message}`);
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchStatus(): Promise<WhatsAppStatus> {
  return bridgeFetch<WhatsAppStatus>('/status');
}

export async function sendMessage(
  phone: string,
  message: string
): Promise<{ messageId: string }> {
  const data = await bridgeFetch<{ ok: boolean; messageId: string }>(
    '/send',
    { method: 'POST', body: { phone, message } }
  );
  return { messageId: data.messageId };
}

export async function logout(): Promise<void> {
  await bridgeFetch<{ ok: boolean }>('/logout', { method: 'POST' });
}

/**
 * Pre-check a phone number using the same normaliser as the bridge so we can
 * fail fast in the API without burning a bridge round-trip.
 */
export function isLikelyWhatsAppNumber(raw: string): boolean {
  const digits = (raw ?? '').replace(/[^0-9]/g, '');
  if (!digits) return false;
  if (digits.length === 10) return true;
  if (digits.length === 11 && digits.startsWith('0')) return true;
  if (digits.length >= 11 && digits.length <= 15) return true;
  return false;
}
