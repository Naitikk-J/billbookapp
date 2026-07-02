# Safarmate WhatsApp Bridge

Tiny self-hosted Node.js service that drives WhatsApp Web via [`@whiskeysockets/baileys`](https://github.com/WhiskeySockets/Baileys) — a pure-JS multi-device implementation, so **no Chromium is involved**. It exposes a locked-down HTTP API the Safarmate Admin Portal calls to send payment-reminder messages from the Ledger page.

**Why Baileys and not `whatsapp-web.js`?** Baileys speaks WhatsApp's protocol directly over WebSocket, which lets the bridge fit in **~100 MB of RAM and boot in ~2 s**. That's a 5× memory reduction over the Puppeteer-based library, which is what makes the bridge run comfortably on Render's free tier.

The session lives in **MongoDB** (whichever Atlas cluster Safarmate already uses), so a cold-booted container restores WhatsApp automatically — **one QR scan ever**, then Render can sleep/wake all day and reminders keep working.

## Security model

- Every endpoint except `/health` requires `Authorization: Bearer <WHATSAPP_BRIDGE_TOKEN>`. The check uses `crypto.timingSafeEqual` so the token can't be brute-forced via timing.
- The bearer token and Mongo URI live in the bridge's environment and the Safarmate server's environment. Nothing sensitive is ever sent to the browser.
- WhatsApp session material (Signal keys, credentials) is stored **only** in a single MongoDB collection you control. It never touches the browser and never touches disk on the container (which is important because Render's free tier has no persistent disk).

## Setup — local

```bash
cd whatsapp-bridge
npm install

cp .env.example .env
# Fill in:
#   WHATSAPP_BRIDGE_TOKEN=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
#   MONGODB_URI=<same Atlas connection string Safarmate uses>

npm run dev
```

Then, in `server/.env` (or your Vercel server project's env vars):

```bash
WHATSAPP_BRIDGE_URL=http://localhost:5555
WHATSAPP_BRIDGE_TOKEN=<same value as above>
```

## Setup — Render (free tier, recommended)

The repo ships with a root-level `render.yaml` Blueprint that provisions the bridge in one click.

1. Push this repo to GitHub if you haven't already.
2. Generate a token: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
3. Go to https://dashboard.render.com → **New → Blueprint** → connect the repo (branch `main`). Render auto-detects the repo-root `render.yaml`.
4. Paste both secrets when prompted:
   - `WHATSAPP_BRIDGE_TOKEN` — the hex string above
   - `MONGODB_URI` — reuse the connection string from your Safarmate server env
5. Deploy. Grab the URL Render assigns (e.g. `https://safarmate-whatsapp.onrender.com`).
6. On Vercel → Safarmate server project → Environment Variables:
   - `WHATSAPP_BRIDGE_URL = https://safarmate-whatsapp.onrender.com`
   - `WHATSAPP_BRIDGE_TOKEN = <same token>`
   Redeploy so the env vars take effect.
7. Open Safarmate → **Settings → WhatsApp reminders**. First load may show "Waking the bridge…" for a few seconds — Render is cold-starting. Then the QR appears. Scan it once with your phone's *Linked devices* screen. Reminder buttons on the Ledger page go live.

Free-tier behaviour after the first scan:

- Render sleeps the container after ~15 min of no traffic.
- Next time Safarmate polls the bridge (Settings page open, or someone clicks Send Reminder), Render wakes it in ~30 s.
- The bridge restores its WhatsApp session from Mongo, reconnects to WhatsApp, and flips back to `ready` — **no QR scan needed**.

## First-time login — what to expect

1. Open Safarmate → Settings → WhatsApp reminders. You'll see "Waking the bridge…" for a few seconds.
2. A QR code appears.
3. On your phone: WhatsApp → Settings → **Linked devices → Link a device** → scan.
4. Card flips to "Connected" within ~5 s. Session is snapshotted into Mongo automatically.

## Endpoints

All calls require `Authorization: Bearer <token>` (except `/health`).

| Method | Path       | Body                          | Response                                                                                             |
| ------ | ---------- | ----------------------------- | ---------------------------------------------------------------------------------------------------- |
| GET    | `/health`  | —                             | `{ ok, name, uptime }` — no auth, for liveness checks                                                |
| GET    | `/status`  | —                             | `{ state, ready, qrDataUrl, qrIssuedAt, message, account }` — `state` is one of `initializing` / `qr` / `authenticated` / `ready` / `disconnected` / `auth_failure` |
| POST   | `/send`    | `{ phone, message }`          | `{ ok: true, messageId }` or `{ error }`                                                             |
| POST   | `/logout`  | —                             | `{ ok: true }` — logs out from WhatsApp on your phone, purges the Mongo session, and re-emits a fresh QR |

Phone numbers can be free-form (`+91 98765 43210`, `9876543210`, `0987654321`, `9198765 43210`). 10-digit numbers are assumed Indian and prefixed with `91`.

## Notes

- Baileys is community-maintained but tracks WhatsApp Web changes quickly. If a `sendMessage` call ever starts hanging, `npm i @whiskeysockets/baileys@latest` and redeploy.
- Don't blast messages — WhatsApp will silently shadow-ban abusive senders. Safarmate rate-limits reminders to one per customer per 60 seconds.
- The `whatsapp_session` collection in Mongo is small (~1–5 MB). It stays inside your existing Atlas free tier without eating into your Safarmate data budget.
