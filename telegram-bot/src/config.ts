import dotenv from 'dotenv';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dir, '../.env') });

function req(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

export const config = {
  botToken: req('TELEGRAM_BOT_TOKEN'),
  apiUrl: req('SAFARMATE_API_URL').replace(/\/$/, ''),
  publicAppUrl: (process.env.SAFARMATE_PUBLIC_URL ?? '').replace(/\/$/, ''),
  email: req('SAFARMATE_EMAIL'),
  password: req('SAFARMATE_PASSWORD'),
  allowedEntries: (process.env.TELEGRAM_ALLOWED_CHAT_IDS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
};

const allowedChatIds = config.allowedEntries.filter((e) => /^-?\d+$/.test(e));
const allowedUsernames = config.allowedEntries
  .filter((e) => !/^-?\d+$/.test(e))
  .map((e) => e.replace(/^@/, '').toLowerCase());

export function isChatAllowed(chatId: number, username?: string | null): boolean {
  if (config.allowedEntries.length === 0) return true;
  if (allowedChatIds.includes(String(chatId))) return true;
  const un = (username ?? '').replace(/^@/, '').trim().toLowerCase();
  if (un && allowedUsernames.includes(un)) return true;
  return false;
}
