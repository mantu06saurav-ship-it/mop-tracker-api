"""Configurable daily sequential auto-scrape sweep across all 5 portals, plus a
per-minute check that fires the daily snapshot email once `send_time` has passed for the day.
"""

import asyncio
import logging
from datetime import datetime
from zoneinfo import ZoneInfo

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy import text

from app.core.constants import AUTO_SCRAPE_PORTALS
from app.db.session import get_conn
from app.services import email_state
from app.services.job_store import job_store
from app.services.scrape_orchestrator import run_all_portals_job, run_scrape_job

logger = logging.getLogger("mop_tracker.scheduler")
_SCHEDULE_TZ = ZoneInfo("Asia/Kolkata")
_DEFAULT_SCRAPE_TIMES = ["00:00", "06:00", "12:00", "18:00"]
_scheduler: AsyncIOScheduler | None = None


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


def start_all_portals_job(portal_records: dict[str, list[dict]]) -> str:
    total = sum(len(records) for records in portal_records.values())
    job_id = job_store.create(total)
    asyncio.create_task(run_all_portals_job(job_id, portal_records))
    return job_id


async def _auto_scrape_tick() -> None:
    # Sequential, not parallel — avoids multiple concurrent Chromium instances, same as the
    # Node app's cron handler.
    portal_records = {portal: fetch_records_from_db(portal) for portal in AUTO_SCRAPE_PORTALS}
    total = sum(len(records) for records in portal_records.values())
    if not total:
        logger.info("Auto-scrape skipped: no rows are configured")
        return
    job_id = start_all_portals_job(portal_records)
    logger.info("Auto-scrape sweep started job_id=%s records=%d", job_id, total)


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


def configure_auto_scrape_schedule(enabled: bool, times: list[str]) -> None:
    if _scheduler is None:
        return

    for job in _scheduler.get_jobs():
        if job.id.startswith("auto_scrape_"):
            _scheduler.remove_job(job.id)

    if not enabled:
        logger.info("Automatic scrape schedule disabled")
        return

    for run_time in sorted(set(times)):
        try:
            hour, minute = (int(part) for part in run_time.split(":"))
        except (ValueError, AttributeError):
            logger.warning("Ignoring invalid automatic scrape time %r", run_time)
            continue
        if not 0 <= hour <= 23 or not 0 <= minute <= 59:
            logger.warning("Ignoring invalid automatic scrape time %r", run_time)
            continue
        job_id = f"auto_scrape_{hour:02d}{minute:02d}"
        _scheduler.add_job(
            _auto_scrape_tick,
            CronTrigger(hour=hour, minute=minute, timezone=_SCHEDULE_TZ),
            id=job_id,
            replace_existing=True,
            max_instances=1,
            coalesce=True,
        )
    logger.info("Automatic scrape schedule updated enabled=%s times=%s IST", enabled, sorted(set(times)))


def start_scheduler() -> AsyncIOScheduler:
    global _scheduler
    scheduler = AsyncIOScheduler(timezone=_SCHEDULE_TZ)
    with get_conn() as conn:
        row = conn.execute(text("SELECT enabled, times FROM dbo.scrape_schedule_settings WHERE id = 1")).fetchone()
    enabled = bool(row.enabled) if row is not None else True
    times = sorted(set(time.strip() for time in row.times.split(",") if time.strip())) if row is not None and row.times else _DEFAULT_SCRAPE_TIMES
    _scheduler = scheduler
    configure_auto_scrape_schedule(enabled, times)
    scheduler.add_job(_email_tick, CronTrigger.from_crontab("* * * * *"), id="email_tick")
    scheduler.start()
    return scheduler
