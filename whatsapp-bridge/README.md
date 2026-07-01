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

## Deploying to Render (recommended for 24/7)

Render's free "Web Service" plan runs this Dockerfile with an HTTPS URL out of the box. Trade-offs of the free tier:

- **Sleeps after ~15 min of no traffic.** First request wakes it in ~30–60 s.
- **No persistent disk.** The `.wwebjs_auth/` session is wiped on every cold boot, so you re-scan the QR after each wake. The QR is shown right in **Settings → WhatsApp reminders**, so this is one tap.
- **512 MB RAM.** Chromium is tuned to fit; if it OOMs, upgrade to the $7/mo Starter plan (which also gets you a persistent disk → no more re-scans).

Steps:

1. Push this repo to GitHub if you haven't already.
2. Generate a token: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
3. Go to https://dashboard.render.com → **New** → **Blueprint** → connect the repo (branch `main`). Render auto-detects the repo-root `render.yaml`; do **not** set a root directory — the Blueprint itself points at `./whatsapp-bridge/Dockerfile`.
4. When prompted, paste the token into `WHATSAPP_BRIDGE_TOKEN`.
5. Deploy. Grab the URL Render assigns (e.g. `https://safarmate-whatsapp.onrender.com`).
6. On Vercel → Safarmate server project → Settings → Environment Variables, set:
   - `WHATSAPP_BRIDGE_URL=https://safarmate-whatsapp.onrender.com`
   - `WHATSAPP_BRIDGE_TOKEN=<same token>`

   Redeploy the server so the env vars take effect.
7. Open Safarmate → **Settings → WhatsApp reminders**. First load shows "Waking the bridge…"; after ~30–60 s the QR appears. Scan it with your phone's *Linked devices* screen. Send Reminder buttons on the Ledger page go live.

Every time Render puts the container to sleep and you next open Safarmate, the Settings card automatically shows a fresh QR — one scan, done.

## Alternative: run on your own always-on machine

If you have a Raspberry Pi, home server, or a laptop that stays on, the cheapest option is **local + Cloudflare Tunnel** (free HTTPS URL, no cloud bill, session persists forever so no re-scans):

```bash
# In one terminal:
cd whatsapp-bridge
npm install
cp .env.example .env  # set WHATSAPP_BRIDGE_TOKEN
npm run start         # or use pm2 for autorestart

# In another terminal:
cloudflared tunnel --url http://localhost:5555
```

Put the `https://...trycloudflare.com` URL into the Safarmate server env as `WHATSAPP_BRIDGE_URL`.

For a permanent Cloudflare Tunnel (custom domain, survives reboots), see the [Cloudflare Zero Trust docs](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/).

## Notes on whatsapp-web.js

- It drives the real WhatsApp Web. Meta does not officially support this; they could change the protocol at any time. If a message ever just spins, run `npm i whatsapp-web.js@latest` and `pm2 restart safarmate-whatsapp`.
- Don't blast messages — WhatsApp will silently shadow-ban abusive senders. The Safarmate UI rate-limits reminders per customer (one per 60 seconds).
