import type { Response } from 'express';
import { memoryCache } from './memoryCache';

export const CACHE_TTL = {
  companyMs: 120_000,
  catalogMs: 60_000,
  invoicesListMs: 45_000,
  invoiceStatsMs: 45_000,
  ledgerSummaryMs: 45_000,
  templatesMs: 3_600_000,
} as const;

export function companyCachePrefix(companyId: string): string {
  return `co:${companyId}:`;
}

export function companyCacheKey(companyId: string, ...parts: string[]): string {
  return `${companyCachePrefix(companyId)}${parts.join(':')}`;
}

export function invalidateCompanyCache(companyId: string): void {
  memoryCache.deletePrefix(companyCachePrefix(companyId));
}

export function querySuffix(params: Record<string, string | undefined>): string {
  const pairs = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== '')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${encodeURIComponent(v ?? '')}`);
  return pairs.length ? pairs.join('&') : '_';
}

function cloneForCache<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export async function respondCached(
  res: Response,
  key: string,
  ttlMs: number,
  loader: () => Promise<unknown>
): Promise<void> {
  const cached = memoryCache.get<unknown>(key);
  if (cached !== undefined) {
    res.set('X-Cache', 'HIT');
    res.set('Cache-Control', `private, max-age=${Math.max(1, Math.floor(ttlMs / 1000))}`);
    res.json(cached);
    return;
  }

  const body = await loader();
  const payload = cloneForCache(body);
  memoryCache.set(key, payload, ttlMs);
  res.set('X-Cache', 'MISS');
  res.set('Cache-Control', `private, max-age=${Math.max(1, Math.floor(ttlMs / 1000))}`);
  res.json(payload);
}
