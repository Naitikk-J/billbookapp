import dotenv from 'dotenv';

dotenv.config();

function readEnv(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  return value ?? '';
}

function requireEnv(name: string): string {
  const value = readEnv(name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 5000),
  get mongoUri(): string {
    return requireEnv('MONGODB_URI');
  },
  get jwtSecret(): string {
    return requireEnv('JWT_SECRET');
  },
  get jwtRefreshSecret(): string {
    return requireEnv('JWT_REFRESH_SECRET');
  },
  jwtAccessExpires: process.env.JWT_ACCESS_EXPIRES ?? '15m',
  jwtRefreshExpires: process.env.JWT_REFRESH_EXPIRES ?? '30d',
  corsOrigin: (process.env.CORS_ORIGIN ?? 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  geminiApiKey: process.env.GEMINI_API_KEY ?? '',
  geminiModel: process.env.GEMINI_MODEL ?? 'gemini-2.5-flash',
  whatsappBridgeUrl: (process.env.WHATSAPP_BRIDGE_URL ?? '').replace(/\/+$/, ''),
  whatsappBridgeToken: process.env.WHATSAPP_BRIDGE_TOKEN ?? '',
} as const;

export const isProd = env.nodeEnv === 'production';
