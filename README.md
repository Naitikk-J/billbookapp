# Safarmate Admin Portal

The operations cockpit for travel agencies — invoices, ledger, customers, products, and a live **flight Kanban board** that watches your inbox and ingests ticket PDFs.

> Status: MVP — auth, customer/product CRUD, invoice builder with four PDF templates, OKCredit-style ledger with PDF statements, AI-powered invoice drafting, and the new Flight Status board (Gmail IMAP sync + PDF parsing via Gemini).

## Flight Status board

- Kanban columns: Booked → Confirmed → Checked-in → Boarding → Delayed → Departed → Arrived → Cancelled / Missed.
- **Sync inbox** pulls recent Gmail messages over IMAP (App Password, 2FA required) and Gemini extracts PNR, route, times and status. Existing cards update by PNR; unknown PNRs become new cards.
- **Upload PDF** sends a ticket straight to Gemini for one-off cards (no email needed).
- **Paste email** lets you forward an airline message manually when IMAP isn't connected.
- Drag-and-drop powered by `@dnd-kit`.

Add `GMAIL_ADDRESS` / Gmail App Password in Settings → Flight automation. Add `GEMINI_API_KEY` either company-wide in Settings → AI assistant or as a server env.

## Stack

**Frontend** — React 18, Vite, TypeScript, TailwindCSS, ShadCN-style primitives, Framer Motion, Redux Toolkit, TanStack React Query, React Hook Form, Zod, Axios, `@react-pdf/renderer`.

**Backend** — Node 20, Express, TypeScript, Mongoose, JWT (access + refresh), Helmet, express-rate-limit, Zod validation, mongo-sanitize.

**Database** — MongoDB Atlas.

**Deployment** — Vercel for both the frontend (`client`) and the backend (`server`, deployed as a serverless function).

## Repo layout

```
.
├── client/    # Vite + React app  (app.your-domain.com)
└── server/    # Express + TS API  (api.your-domain.com)
```

## Local development

Prereqs: Node 18.18+, a MongoDB Atlas connection string.

```bash
npm install
cp server/.env.example server/.env        # fill MONGODB_URI, JWT_SECRET, JWT_REFRESH_SECRET
cp client/.env.example client/.env        # VITE_API_URL=http://localhost:5050/api
npm run dev
```

- Client → http://localhost:5173
- Server → http://localhost:5050/api/health

> Note: macOS's AirPlay Receiver service occupies port 5000 by default, so the API runs on **5050** locally. You can change this in `server/.env` (`PORT`) and `client/.env` (`VITE_API_URL`).

## Deploying to Vercel

This monorepo deploys as **two separate Vercel projects** pointing at the same repo:

### 1. API project (`server/`)

- New Vercel project → set **Root Directory** = `server`
- Framework preset: **Other**
- Build command: `npm run build`
- Output directory: leave blank (Vercel uses `api/` serverless function)
- Environment variables:
  - `MONGODB_URI`
  - `JWT_SECRET`
  - `JWT_REFRESH_SECRET`
  - `CORS_ORIGIN` — e.g. `https://app.your-domain.com,http://localhost:5173`
  - `NODE_ENV=production`

### 2. Web project (`client/`)

- New Vercel project → set **Root Directory** = `client`
- Framework preset: **Vite**
- Environment variables:
  - `VITE_API_URL` — e.g. `https://api.your-domain.com/api`

## Scripts

```bash
npm run dev          # client + server in parallel
npm run build        # production build for both
npm run typecheck    # type-check both workspaces
```

## Roadmap

The current build implements the MVP slice; advanced features (AI builder, 50 templates, email engine, payments, multi-currency, audit logs, RBAC, reporting) are scaffolded for incremental delivery.
