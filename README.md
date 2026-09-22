# MOP Tracker API (Python / FastAPI)

A from-scratch Python port of the Node.js `MOP_TRACKER` app, built for a **Next.js** frontend
(this repo is API-only — no server-rendered pages). It reads/writes the **same MSSQL database**
(`dbo.mop_data`, `dbo.mop_tracker`, `dbo.Users`, etc.) as the Node app, so both can point at the
same server during a transition, though **the two apps do not share the in-memory scrape-job
state** (each process tracks its own jobs).

Stack: **FastAPI** + **SQLAlchemy/pyodbc** (MSSQL) + **Scrapy + Playwright** (scraping) +
**APScheduler** (cron equivalent) + **openpyxl/pandas** (Excel) + **PyJWT/bcrypt** (auth).

## Setup

```bash
# 1. Create a virtualenv and install dependencies
python -m venv .venv
.venv\Scripts\activate          # Windows
pip install -r requirements.txt

# 2. Install Playwright's Chromium (one-time)
playwright install chromium

# 3. Install the MSSQL ODBC driver (not a pip package — a system driver)
#    Download "ODBC Driver 17 (or 18) for SQL Server" from Microsoft and install it,
#    or set DB_ODBC_DRIVER in .env to whatever driver name `odbcinst -q -d` shows on your machine.

# 4. Configure environment
copy .env.example .env
#    Fill in JWT_SECRET (long random string — no default is used, unlike the Node app which
#    fell back to "dev-secret-change-me"), DB_*, SMTP_*, CORS_ORIGINS (your Next.js origin).

# 5. Run
uvicorn app.main:app --reload --port 8000
```

On startup the app creates/upgrades every table it needs (mirrors the Node app's
`OBJECT_ID`/`ALTER TABLE` checks) — no separate migration step required, safe to point at a
brand-new database.

## Endpoints

Same paths as the Node app (so an existing Next.js integration or Postman collection ports over
unchanged), grouped here by area:

| Area | Endpoints |
|---|---|
| Auth | `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`, `PUT /api/auth/password`, `POST /api/auth/avatar` |
| Users | `GET /api/users`, `PUT /api/users/{id}` (Super Admin only) |
| MOP data | `GET /mop-data-status`, `POST /upload-mop-data` |
| Scrape jobs | `POST /run-from-db?portal=`, `GET /job/{job_id}` |
| Dashboard/reports | `GET /dashboard`, `GET /batches`, `GET /api/trends`, `GET /api/portal-breakdown`, `GET /api/compliance-daily`, `GET /report/download` |
| Seller mapping | `GET/POST /api/seller-mapping`, `PUT/DELETE /api/seller-mapping/{id}`, `PUT /api/seller-mapping/{id}/email-toggle` |
| Email | `GET/PUT /api/email-settings`, `POST /api/email-settings/send-now`, `POST /send-below-mop-report` |
| Inventory | `GET /inventory-data-status`, `POST /upload-inventory-data`, `GET /inventory-data` |
| SAP ZFG master data | `GET /latest-zfg-status`, `POST /upload-latest-zfg`, `GET /latest-zfg-data` |
| Audit report | `GET /api/audit-report`, `GET /api/audit-report/download` |
| Public catalog | `GET /api/products/public` |

Interactive docs at `/docs` once running.

## How scraping works

Each of the 5 marketplaces (Flipkart, Amazon, Myntra, Ajio, Snapdeal) is a **Scrapy spider**
under `app/scraping/spiders/`. Flipkart/Myntra/Ajio need a real browser (via
`scrapy-playwright`) because their prices render client-side; Amazon/Snapdeal are scraped with
plain HTTP since their product pages are server-rendered.

`POST /run-from-db?portal=X` reads matching rows from `dbo.mop_data`, creates an in-memory job
(`app/services/job_store.py` — deliberately not persisted, same as the Node app's `jobs = {}`,
lost on restart), and runs the crawl as a background `asyncio` task
(`app/services/scrape_orchestrator.py`) — Scrapy is bridged into FastAPI's own event loop via
Twisted's asyncio reactor rather than shelling out to a subprocess, so job progress updates
land in the same in-memory store you poll via `GET /job/{job_id}`.

A 4x-daily auto-scrape sweep and a per-minute daily-email check run via APScheduler
(`app/services/scheduler.py`), replacing the Node app's `node-cron` jobs.

## Deliberate differences from the Node app

- **No server-rendered pages.** The Node app served `pages/*.html`; this backend is API-only —
  build the UI in Next.js against these same endpoints.
- **No hardcoded credential fallbacks.** The Node app's `DB_CONFIG`/`SMTP_CONFIG` defaulted to
  real production values baked into `server.js` if env vars were unset. This app requires every
  secret (`JWT_SECRET`, `DB_*`, `SMTP_*`) to be set via `.env` — it will fail to start otherwise.
  **Rotate those credentials** if they're still live; they were exposed in the Node source.
- **Auth is applied uniformly** to every data-mutating admin route (seller mapping, email
  settings, user management). The Node app left `/upload-mop-data`, `/upload-inventory-data`,
  `/upload-latest-zfg`, `/run-from-db`, and `/send-below-mop-report` completely unauthenticated;
  this port keeps that as-is too **for exact behavioural parity** — tighten this (add
  `Depends(get_current_user)`/`Depends(require_admin)` in those route files) before exposing the
  API beyond a trusted internal network.
- **Email settings request body uses JSON arrays** (`toEmails: string[]`) instead of the Node
  app's comma-joined string column value — more natural for a Next.js client; still stored the
  same way in `dbo.email_settings` (comma-joined) for compatibility with existing data.
- **Browser-recycle-every-40-records** (a Render-free-tier memory fix in the Node app) isn't
  reproduced 1:1 — Scrapy's own concurrency/memory model is already lighter (`CONCURRENT_REQUESTS
  = 1`, one shared Playwright browser per crawl). Revisit `app/scraping/settings.py` /
  `app/services/scrape_orchestrator.py` if you see memory growth on a constrained host.
- **Inventory/ZFG upload column aliases** (`app/core/constants.py` →
  `INVENTORY_FIELD_DEFS`/`LATEST_ZFG_FIELD_DEFS`) are reasonable defaults inferred from the DB
  schema, not the Node app's literal alias lists (those weren't fully recoverable from source).
  Adjust them to match your actual Excel export headers if uploads report false "missing
  column" errors.
- **`/debug/scrape-one`** (a manual single-FSN Flipkart debug helper in the Node app) was not
  ported — it was a developer convenience, not something a production Next.js frontend calls.

## Known environment note

This was developed/tested against **Python 3.14**. `requirements.txt` uses lower-bound (`>=`)
version pins rather than exact pins on purpose — pandas/pyodbc/etc. need a recent enough release
to ship a prebuilt wheel for very new Python versions; exact old pins can force a from-source
build that fails without Visual Studio build tools installed.
