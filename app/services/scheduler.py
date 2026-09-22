"""node-cron equivalent: a 4x-daily sequential auto-scrape sweep across all 5 portals, plus a
per-minute check that fires the daily snapshot email once `send_time` has passed for the day.
"""

import asyncio
import logging
from datetime import datetime

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy import text

from app.core.constants import AUTO_SCRAPE_PORTALS
from app.db.session import get_conn
from app.services import email_state
from app.services.job_store import job_store
from app.services.scrape_orchestrator import run_scrape_job

logger = logging.getLogger("mop_tracker.scheduler")


def fetch_records_from_db(portal: str) -> list[dict]:
    with get_conn() as conn:
        rows = conn.execute(
            text(
                "SELECT brand, portal, code_type, code, sku_code, mop FROM dbo.mop_data "
                "WHERE LOWER(LTRIM(RTRIM(portal))) = :portal"
            ),
            {"portal": portal.strip().lower()},
        ).fetchall()
    return [dict(r._mapping) for r in rows]


def start_job(portal: str, records: list[dict]) -> str:
    job_id = job_store.create(len(records))
    asyncio.create_task(run_scrape_job(job_id, portal, records))
    return job_id


async def _auto_scrape_tick() -> None:
    # Sequential, not parallel — avoids multiple concurrent Chromium instances, same as the
    # Node app's cron handler.
    for portal in AUTO_SCRAPE_PORTALS:
        records = fetch_records_from_db(portal)
        if records:
            job_id = start_job(portal, records)
            logger.info("Auto-scrape started portal=%s job_id=%s records=%d", portal, job_id, len(records))


async def _email_tick() -> None:
    if email_state.is_sending():
        return
    with get_conn() as conn:
        row = conn.execute(text("SELECT * FROM dbo.email_settings WHERE id = 1")).fetchone()
    if row is None:
        return
    settings_row = dict(row._mapping)
    if settings_row.get("mode") != "auto" or not settings_row.get("enabled"):
        return

    now = datetime.now()
    today_str = now.strftime("%Y-%m-%d")
    if settings_row.get("last_sent_date") == today_str:
        return
    # ">=" (not "==") so a skipped tick under load still fires the send.
    if now.strftime("%H:%M") < (settings_row.get("send_time") or "09:00"):
        return

    if not email_state.try_acquire():
        return
    try:
        from app.services.snapshot_service import deliver_daily_snapshot_email

        to_emails = [e.strip() for e in (settings_row.get("to_emails") or "").split(",") if e.strip()]
        cc_emails = [e.strip() for e in (settings_row.get("cc_emails") or "").split(",") if e.strip()]
        if not to_emails:
            return
        await asyncio.to_thread(deliver_daily_snapshot_email, to_emails, cc_emails)
        with get_conn() as conn:
            conn.execute(
                text("UPDATE dbo.email_settings SET last_sent_date = :d, last_sent_at = GETDATE() WHERE id = 1"),
                {"d": today_str},
            )
    except Exception:  # noqa: BLE001
        logger.exception("Daily snapshot email failed")
    finally:
        email_state.release()


def start_scheduler() -> AsyncIOScheduler:
    scheduler = AsyncIOScheduler()
    scheduler.add_job(_auto_scrape_tick, CronTrigger.from_crontab("0 0,6,12,18 * * *"), id="auto_scrape")
    scheduler.add_job(_email_tick, CronTrigger.from_crontab("* * * * *"), id="email_tick")
    scheduler.start()
    return scheduler
