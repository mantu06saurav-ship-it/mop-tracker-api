# MOP Tracker — Web

A modern Next.js 16 (App Router, TypeScript, Tailwind v4, shadcn/ui) frontend for the MOP Tracker
marketplace price-compliance console. This is a fresh visual design — it does not clone the old
HTML/CSS of the legacy app — but covers the same insights and functionality end-to-end, talking to
the separate FastAPI backend at `../backend` over HTTP.

## Stack

Next.js 16 (Turbopack) · React 19.2 · TypeScript · Tailwind CSS v4 · shadcn/ui (radix-nova style) ·
TanStack Query · Zustand · react-hook-form + zod · recharts · lucide-react · sonner (toasts)

## Setup

```bash
npm install
copy .env.example .env.local   # set NEXT_PUBLIC_API_URL to your FastAPI backend's URL
npm run dev                    # http://localhost:3000
```

The backend must be running (see `../backend/README.md`) and its `CORS_ORIGINS`
env var must include this app's origin (`http://localhost:3000` by default).

## Auth model

JWT-based, matching the backend exactly: `POST /api/auth/login` returns `{token, user}`. The token
is stored in `localStorage` (if "Keep me signed in" is checked) or `sessionStorage` otherwise, and
attached as `Authorization: Bearer <token>` to every API request via an axios interceptor
(`src/lib/api-client.ts`). A 401 response anywhere triggers an automatic logout + hard redirect to
`/login`. There is no refresh-token flow — same as the backend (stateless 8h-expiry JWT).

## Pages / routes

| Route | Purpose | Access |
|---|---|---|
| `/login` | Sign in | Public |
| `/dashboard` | MOP compliance overview — KPIs, MP/OR split, drill-down Compliance Matrix, MOP Breached Summary penalty report, seller-mapping management, below-MOP SKU pivot, trend/portal charts | Any signed-in role |
| `/operations` | Scrape-run overview — KPIs, MOP-vs-price chart, status-split donut, sortable products table, recent batches | Super Admin, Manager |
| `/operations/upload` | Upload MOP data (Excel), trigger a scrape per portal, live job-progress monitor | Super Admin, Manager |
| `/operations/history` | Past scrape batches | Super Admin |
| `/operations/master-data` | Inventory + SAP ZFG master-data upload/browse | Super Admin |
| `/audit-report` | Target (SAP + MOP) vs Actual (scraped) listing audit, grouped by SKU+portal | Any signed-in role |
| `/catalog` | Public product catalog (browsable without login) | Public |
| `/profile` | Own account details, avatar, password change | Any signed-in role |
| `/users` | Team directory (CRUD) + daily email-automation settings + seller email-inclusion toggles | Super Admin |

Role gating is enforced client-side via `<RequireAuth roles={[...]}>` (redirects to `/login` or
`/dashboard` as appropriate) — the backend is the actual authority (see its README for which
endpoints currently lack server-side auth checks, inherited from the original app for parity).

## Architecture notes

- **No Next.js server-side data layer is used** — this is a client-rendered console. Every page is
  a `"use client"` component fetching directly from the FastAPI backend via TanStack Query
  (`src/lib/hooks/*`). There are no Next.js API routes, server actions, or route handlers; Next.js
  here is purely the app shell/router/bundler.
- **Shared infrastructure** (`src/lib/`): `types.ts` (API response shapes), `api-client.ts` (axios
  + auth interceptor), `stores/auth-store.ts` (zustand), `hooks/*` (one file per backend resource
  area), `format.ts` (currency/date/status-color helpers), `csv.ts` (client-side CSV export —
  exports exactly what's currently filtered/sorted on screen, no server round-trip), `penalty.ts`
  (client-side MOP-breach penalty math with live-adjustable tolerance/rates, used by the Dashboard's
  "MOP Breached Summary" table since those inputs recompute on every keystroke).
- **Job polling** (`src/lib/hooks/use-job.ts`): scrape jobs are long-running and tracked server-side
  in-memory by the backend. This hook polls `GET /job/{id}` with resilient exponential backoff,
  treats HTTP 404 as "job gone, likely a backend restart, but already-saved rows are safe" rather
  than a hard failure, and treats 429/503 as transient. Not a naive `setInterval`.
- **Design tokens** (`src/app/globals.css`): a vivid-blue primary + dark-navy sidebar, with explicit
  `--success`/`--warning`/`--info` semantic tokens (registered as real Tailwind color utilities
  alongside shadcn's defaults) used everywhere BELOW_MOP/AT_MOP/ABOVE_MOP-style status coloring is
  needed — see `src/components/shared/status-badge.tsx` for the canonical pattern.

## Known simplifications vs. the legacy app

- The old app's "Compliance Matrix" drill path and its filter dropdowns were two separate
  mechanisms; here they're unified into one filter-state model that both a click-to-drill and a
  direct dropdown selection update — same end result, simpler code.
- Product-catalog images are rendered via plain `<img>` (not `next/image`) since they come from five
  different marketplace CDNs with unpredictable domains — configuring `remotePatterns` for all of
  them would be brittle. A broken image falls back to a placeholder icon.
- Catalog pagination is Prev/Next + "Page X of Y" rather than a full numbered pager with ellipsis
  collapsing.
