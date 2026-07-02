import 'dotenv/config';
import crypto from 'node:crypto';
import express, { type NextFunction, type Request, type Response } from 'express';
import { whatsapp } from './whatsappClient';

const PORT = Number(process.env.PORT ?? 5555);
const HOST = process.env.HOST ?? '127.0.0.1';
const TOKEN = (process.env.WHATSAPP_BRIDGE_TOKEN ?? '').trim();

if (!TOKEN) {
  console.error(
    '[bridge] WHATSAPP_BRIDGE_TOKEN is not set. Generate one with:\n' +
      "  node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"\n" +
      'then put it in .env as WHATSAPP_BRIDGE_TOKEN=...'
  );
  process.exit(1);
}

const app = express();
app.use(express.json({ limit: '256kb' }));

// Constant-time bearer check so the secret can't leak via timing.
function authorised(headerValue: string | undefined): boolean {
  if (!headerValue) return false;
  const prefix = 'Bearer ';
  if (!headerValue.startsWith(prefix)) return false;
  const supplied = Buffer.from(headerValue.slice(prefix.length));
  const expected = Buffer.from(TOKEN);
  if (supplied.length !== expected.length) return false;
  return crypto.timingSafeEqual(supplied, expected);
}

function requireBridgeAuth(req: Request, res: Response, next: NextFunction): void {
  if (!authorised(req.header('authorization'))) {
    res.status(401).json({ error: { message: 'Unauthorised' } });
    return;
  }
  next();
}

app.get('/health', (_req, res) => {
  res.json({ ok: true, name: 'safarmate-whatsapp-bridge', uptime: process.uptime() });
});

app.use(requireBridgeAuth);

app.get('/status', (_req, res) => {
  res.json(whatsapp.getStatus());
});

app.post('/send', async (req, res) => {
  const { phone, message, imageUrl } = (req.body ?? {}) as {
    phone?: string;
    message?: string;
    imageUrl?: string;
  };
  if (!phone || !message) {
    res.status(400).json({ error: { message: 'phone and message are required' } });
    return;
  }
  try {
    const result = await whatsapp.sendMessage(phone, message, imageUrl);
    res.json({ ok: true, messageId: result.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(400).json({ error: { message } });
  }
});

app.post('/logout', async (_req, res) => {
  try {
    await whatsapp.logout();
    res.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: { message } });
  }
});

// Start the HTTP listener immediately so health checks pass while WhatsApp
// is still booting; kick off the WhatsApp connection in the background.
app.listen(PORT, HOST, () => {
  console.log(`[bridge] listening on http://${HOST}:${PORT}`);
});

whatsapp.start().catch((err) => {
  console.error('[bridge] whatsapp.start() failed:', err);
});
