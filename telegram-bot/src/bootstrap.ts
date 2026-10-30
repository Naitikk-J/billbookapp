import { getCompany, warmApiSession } from './api/safarmate.js';

export async function bootstrapBot(): Promise<void> {
  try {
    await warmApiSession();
    await getCompany();
    console.log('[telegram-bot] API session ready');
  } catch (err) {
    console.warn('[telegram-bot] API warmup failed (will retry on first request):', err);
  }
}
