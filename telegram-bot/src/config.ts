import dotenv from 'dotenv';

dotenv.config();

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
  allowedChatIds: (process.env.TELEGRAM_ALLOWED_CHAT_IDS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
};

export function isChatAllowed(chatId: number): boolean {
  if (config.allowedChatIds.length === 0) return true;
  return config.allowedChatIds.includes(String(chatId));
}
