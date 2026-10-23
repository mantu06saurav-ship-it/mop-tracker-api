"""Per-minute check that fires the daily snapshot email once `send_time` has passed for the day.

The auto-scrape sweep no longer runs in this process: scraping moved to a local Windows PC
(`python -m app.scraping.runner --scheduled` via Task Scheduler), which reads the same
dbo.scrape_schedule_settings times that admins edit in the web app.
"""

import asyncio
import logging
from datetime import datetime
from zoneinfo import ZoneInfo

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy import text

from app.db.session import get_conn
from app.services import email_state

logger = logging.getLogger("mop_tracker.scheduler")
_SCHEDULE_TZ = ZoneInfo("Asia/Kolkata")


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
    scheduler = AsyncIOScheduler(timezone=_SCHEDULE_TZ)
    scheduler.add_job(_email_tick, CronTrigger.from_crontab("* * * * *"), id="email_tick")
    scheduler.start()
    return scheduler
