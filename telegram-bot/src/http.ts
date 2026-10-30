const DEFAULT_TIMEOUT_MS = 120_000;
const MAX_ATTEMPTS = 3;

function isRetryable(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const m = err.message.toLowerCase();
  return (
    m.includes('socket hang up') ||
    m.includes('econnreset') ||
    m.includes('etimedout') ||
    m.includes('fetch failed') ||
    m.includes('network') ||
    m.includes('aborted')
  );
}

export async function fetchWithRetry(
  url: string,
  init: RequestInit = {},
  opts?: { timeoutMs?: number; attempts?: number }
): Promise<Response> {
  const timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const attempts = opts?.attempts ?? MAX_ATTEMPTS;
  let lastErr: unknown;

  for (let i = 0; i < attempts; i++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      clearTimeout(timer);
      return res;
    } catch (err) {
      clearTimeout(timer);
      lastErr = err;
      if (i < attempts - 1 && isRetryable(err)) {
        await new Promise((r) => setTimeout(r, 400 * (i + 1)));
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}
