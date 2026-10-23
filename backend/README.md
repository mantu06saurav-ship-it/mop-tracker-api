# MOP Tracker API (Python / FastAPI)

A from-scratch Python port of the Node.js `MOP_TRACKER` app, paired with the **Next.js** frontend
in `../frontend/`. The FastAPI service is API-only; the frontend is deployed as a separate
web service from this same repository. The API reads/writes the **same MSSQL database**
(`dbo.mop_data`, `dbo.mop_tracker`, `dbo.Users`, etc.) as the Node app, so both can point at the
same server during a transition.

**Scraping does not run in the API.** The API (on Render) only serves data, uploads and the
daily email; the marketplace scrapers run on a local Windows PC via Task Scheduler — see
[Scraper PC setup](#scraper-pc-setup).

Stack: **FastAPI** + **SQLAlchemy/pyodbc** (MSSQL) + **APScheduler** (daily email) +
**openpyxl/pandas** (Excel) + **PyJWT/bcrypt** (auth); the scraper PC adds **Scrapy +
Playwright**.

## Setup

Run the following commands from this `backend/` directory.

```bash
# 1. Create a virtualenv and install dependencies
python -m venv .venv
.venv\Scripts\activate          # Windows
pip install -r requirements.txt  # requirements-scraper.txt instead on the scraper PC

# 2. (Scraper PC only) Install Playwright's Chromium (one-time)
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
| Dashboard/reports | `GET /dashboard`, `GET /batches`, `GET /api/trends`, `GET /api/portal-breakdown`, `GET /api/compliance-daily`, `GET /report/download` |
| Seller mapping | `GET/POST /api/seller-mapping`, `PUT/DELETE /api/seller-mapping/{id}`, `PUT /api/seller-mapping/{id}/email-toggle` |
| Email | `GET/PUT /api/email-settings`, `POST /api/email-settings/send-now`, `POST /send-below-mop-report` |
| Auto-scrape schedule | `GET/PUT /api/scrape-schedule` (Super Admin updates; authenticated users can view; includes the scraper PC's last run status) |
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

The spiders run from the command-line runner `app/scraping/runner.py`, not from the API — headless
Chromium needs more memory than the Render instance has. The runner reads products from
`dbo.mop_data`, crawls the portals one after another under a single `batch_id`, and the pipeline
inserts each result into `dbo.mop_tracker`, so the dashboard and History pages read them as before.

Every run writes `last_run_status` / `last_run_summary` to `dbo.scrape_schedule_settings`, shown
on the Upload Products page and the Manage Users → Auto-Scrape card. The API's APScheduler
(`app/services/scheduler.py`) now only runs the per-minute daily-email check.

There are two ways to decide **when** scraping runs:

- **Option A — days and times set in Windows Task Scheduler** (step-by-step guide below). The
  task runs `app.scraping.runner`, which scrapes immediately. The Auto-Scrape times in the web app
  are **not** used in this mode.
- **Option B — times set in the web app** (Manage Users → Auto-Scrape). A task created by
  `scripts\install-scraper-task.ps1` starts the runner with `--scheduled` every 15 minutes; it
  scrapes only when one of the web app's times has passed and hasn't run yet.

Use one option, not both.

## Scraper PC setup

On the Windows PC that will do the scraping (it must be switched on, with internet, at the
scheduled times). The paths below assume the repository is at `E:\AI_Project\MOP_TRACKER_API` —
change them if yours is elsewhere.

### 1. One-time install

1. Install Python and Microsoft's **ODBC Driver 18 for SQL Server**, and get this repository.
2. In PowerShell, inside the `backend` folder:
   ```powershell
   python -m venv .venv
   .venv\Scripts\pip install -r requirements-scraper.txt
   .venv\Scripts\playwright install chromium
   copy .env.example .env   # same DB_* values as the Render API (JWT/SMTP are unused but required)
   ```
3. Check it works without saving anything:
   ```powershell
   .venv\Scripts\python -m app.scraping.runner --portal myntra --limit 3 --dry-run
   ```
   You should see three `[dry-run] myntra ...: SUCCESS` lines and `Scrape run DONE`.

### 2. Option A: create the task in Task Scheduler yourself

1. Press **Win**, type **Task Scheduler**, and open it.
2. In the right-hand **Actions** panel, click **Create Task…** (not "Create Basic Task" — it hides
   settings needed below).
3. **General** tab
   - **Name:** `MOP Tracker Scraper`
   - Select **Run whether user is logged on or not**, and tick **Do not store password**. The task
     then runs in the background even after you sign out or lock the PC.
     (If saving fails with a logon or "batch job" error, choose **Run only when user is logged
     on** instead. It still runs without opening a window.)
   - Leave **Run with highest privileges** unticked.
4. **Triggers** tab: one trigger per daily run time. Click **New…**:
   - **Begin the task:** On a schedule
   - **Every day:** choose **Daily**, Recur every **1** days.
     **Only some days:** choose **Weekly**, Recur every **1** weeks, and tick the days
     (e.g. Monday–Saturday).
   - **Start:** today's date and the run time, e.g. `06:00:00`. (The PC's clock should be on
     India Standard Time.)
   - Make sure **Enabled** is ticked at the bottom, then **OK**.
   - Repeat **New…** for every other time, e.g. 00:00, 12:00 and 18:00 for four runs a day.
5. **Actions** tab → **New…**:
   - **Action:** Start a program
   - **Program/script:** `E:\AI_Project\MOP_TRACKER_API\backend\.venv\Scripts\pythonw.exe`
   - **Add arguments:** `-m app.scraping.runner`
   - **Start in:** `E:\AI_Project\MOP_TRACKER_API\backend` (no quotes, no trailing `\`). Required:
     without it the runner can't find `app` or `.env`.
   - **OK**. (`pythonw.exe`, not `python.exe`, so no console window appears.)
6. **Conditions** tab
   - Untick **Start the task only if the computer is on AC power** (matters on laptops).
   - Optional: tick **Wake the computer to run this task** if the PC sleeps.
7. **Settings** tab
   - Tick **Allow task to be run on demand**.
   - Tick **Run task as soon as possible after a scheduled start is missed** (catches up if the
     PC was off at the scheduled time).
   - Tick **Stop the task if it runs longer than** and pick **12 hours**.
   - **If the task is already running, then the following rule applies:** **Do not start a new
     instance**.
8. Click **OK**. If Windows asks for your password, enter your Windows login password.
9. Test it: right-click **MOP Tracker Scraper** → **Run**. Within a minute,
   `backend\logs\scraper-<today's date>.log` should show `myntra: scraping ...`-style lines, and the
   Upload Products page shows "A price check is running…". A full sweep of every product takes
   a few hours; the log ends with `Scrape run DONE: flipkart …/…; amazon …/…; …`.

To **change** the days or times later: open Task Scheduler → **Task Scheduler Library** → double-click
**MOP Tracker Scraper** → **Triggers** tab → **Edit…** / **New…** / **Delete**. To stop scraping,
right-click the task → **Disable**.

### Option B: follow the web app's Auto-Scrape times

From an **elevated** PowerShell ("Run as administrator") in the `backend` folder:
```powershell
powershell -ExecutionPolicy Bypass -File scripts\install-scraper-task.ps1
```
This registers the same "MOP Tracker Scraper" task, starting `pythonw -m app.scraping.runner
--scheduled` (hidden) every 15 minutes. Turn **Enable automatic scraping** on under Manage Users →
Auto-Scrape. Remove the task with `... install-scraper-task.ps1 -Uninstall`; add `-WakeToRun` to
wake the PC from sleep.

### Logs and manual runs

- Logs: `backend\logs\scraper-YYYY-MM-DD.log` (kept 14 days).
- To scrape right away: double-click `backend\scripts\scrape-now.cmd`, or run
  `.venv\Scripts\python -m app.scraping.runner` (add `--portal amazon` to scrape one portal).
- Only one run at a time: a run started while another is still going logs "Another scrape run
  is still in progress" and exits.

## Deploy on Render

The repository-root `../render.yaml` defines both services. The API builds from this directory
with Docker to install Microsoft's SQL Server ODBC driver (no Chromium — scraping runs on the
scraper PC); the Next.js service uses `../frontend/`
as its root directory. The
Blueprint wires `NEXT_PUBLIC_API_URL` to the API's public URL .
After the frontend service gets its public URL, add it to the API service's `CORS_ORIGINS` environment variable and redeploy the API. Sync the Blueprint after pushing changes to create or update both services.

## Deliberate differences from the Node app

- **The API does not serve pages.** The Next.js interface lives in `../frontend/` and runs as a
  separate web service from this repository.
- **No hardcoded credential fallbacks.** The Node app's `DB_CONFIG`/`SMTP_CONFIG` defaulted to
  real production values baked into `server.js` if env vars were unset. This app requires every
  secret (`JWT_SECRET`, `DB_*`, `SMTP_*`) to be set via `.env` — it will fail to start otherwise.
  **Rotate those credentials** if they're still live; they were exposed in the Node source.
- **Auth is applied uniformly** to every data-mutating admin route (seller mapping, email
  settings, user management). The Node app left `/upload-mop-data`, `/upload-inventory-data`,
  `/upload-latest-zfg`, and `/send-below-mop-report` completely unauthenticated;
  this port keeps that as-is too **for exact behavioural parity** — tighten this (add
  `Depends(get_current_user)`/`Depends(require_admin)` in those route files) before exposing the
  API beyond a trusted internal network.
- **Email settings request body uses JSON arrays** (`toEmails: string[]`) instead of the Node
  app's comma-joined string column value — more natural for a Next.js client; still stored the
  same way in `dbo.email_settings` (comma-joined) for compatibility with existing data.
- **Scraping moved off the web host.** The Node app (and this API at first) scraped inside the
  web process, with a browser-recycle-every-40-records workaround for Render's memory limit; the
  scrapers now run on a Windows PC instead, and the "Run scraping" controls were removed from the
  frontend.
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
