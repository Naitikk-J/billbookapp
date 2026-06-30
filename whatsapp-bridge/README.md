# Safarmate WhatsApp Bridge

Tiny self-hosted Node.js service that drives WhatsApp Web via [`whatsapp-web.js`](https://wwebjs.dev/) and exposes a locked-down HTTP API for the Safarmate Admin Portal to send payment-reminder messages from the Ledger page.

This service runs **outside** Vercel (Vercel serverless functions can't keep a Chromium browser alive). Run it on your own laptop, a VPS, or any always-on container. The Vercel-hosted Safarmate server calls it over the network with a shared secret; the browser never sees any secret.

## Security model

- Every endpoint except `/health` requires `Authorization: Bearer <WHATSAPP_BRIDGE_TOKEN>`. The check uses `crypto.timingSafeEqual` so the token can't be brute-forced via timing.
- The token lives in **two places only**: this service's `.env` and the Safarmate server's environment variables. It is **never** sent to the browser.
- By default the server binds to `127.0.0.1`. If you expose it to the internet you MUST put it behind TLS (Cloudflare Tunnel, ngrok with HTTPS, Caddy, nginx + Let's Encrypt). Plain HTTP to a public address would leak the bearer token.
- WhatsApp session tokens are stored locally in `.wwebjs_auth/` (gitignored). They never leave the machine.

## Setup

```bash
cd whatsapp-bridge
npm install

# Create your bridge token:
cp .env.example .env
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Paste the output as WHATSAPP_BRIDGE_TOKEN= in .env

npm run dev
```

Then, in the Safarmate server's environment (Vercel project → Settings → Environment Variables, or local `server/.env`):

```bash
WHATSAPP_BRIDGE_URL=http://localhost:5555           # local dev
# WHATSAPP_BRIDGE_URL=https://your-tunnel.example  # production
WHATSAPP_BRIDGE_TOKEN=<same value as above>
```

## First-time login

1. Run `npm run dev` (or `npm run build && npm start` in prod).
2. Open the Safarmate Admin Portal → **Settings → WhatsApp**. A QR code will appear.
3. On your phone: WhatsApp → Settings → Linked devices → Link a device → scan.
4. The status will flip to **Connected**. The session is persisted in `.wwebjs_auth/`, so restarting the bridge does NOT require a re-scan.

## Endpoints

All calls require `Authorization: Bearer <token>` (except `/health`).

| Method | Path        | Body                                | Response                                                                                             |
| ------ | ----------- | ----------------------------------- | ---------------------------------------------------------------------------------------------------- |
| GET    | `/health`   | —                                   | `{ ok, name, uptime }` — no auth, for liveness checks                                                |
| GET    | `/status`   | —                                   | `{ state, ready, qrDataUrl, qrIssuedAt, message, account }` — `state` is one of `initializing` / `qr` / `authenticated` / `ready` / `disconnected` / `auth_failure` |
| POST   | `/send`     | `{ phone, message }`                | `{ ok: true, messageId }` or `{ error }`                                                             |
| POST   | `/logout`   | —                                   | `{ ok: true }` — logs out the linked device, deletes the session, re-emits a fresh QR                |

Phone numbers can be free-form (`+91 98765 43210`, `9876543210`, `0987654321`, `9198765 43210`). 10-digit numbers are assumed Indian and prefixed with `91`.

## Running on a VPS

The simplest setup is `pm2`:

```bash
npm install -g pm2
pm2 start "npm run start" --name safarmate-whatsapp -- --silent
pm2 save
pm2 startup
```

For a public URL, the cleanest free option is Cloudflare Tunnel:

```bash
cloudflared tunnel --url http://localhost:5555
```

Put the resulting `https://...trycloudflare.com` URL into the Safarmate server's `WHATSAPP_BRIDGE_URL`.

## Notes on whatsapp-web.js

- It drives the real WhatsApp Web. Meta does not officially support this; they could change the protocol at any time. If a message ever just spins, run `npm i whatsapp-web.js@latest` and `pm2 restart safarmate-whatsapp`.
- Don't blast messages — WhatsApp will silently shadow-ban abusive senders. The Safarmate UI rate-limits reminders per customer (one per 60 seconds).
