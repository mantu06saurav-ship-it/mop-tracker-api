"""Command-line scrape runner — scraping runs on a local Windows PC via Task Scheduler instead of
inside the Render-hosted API (headless Chromium needs more memory than the Render instance has).

    python -m app.scraping.runner --scheduled         # what Task Scheduler runs every 15 minutes
    python -m app.scraping.runner                     # scrape every portal right now
    python -m app.scraping.runner --portal myntra --portal ajio
    python -m app.scraping.runner --portal amazon --limit 5 --dry-run

`--scheduled` keeps the web app's Auto-Scrape schedule (Manage Users → Auto-Scrape, stored in
dbo.scrape_schedule_settings) authoritative: each invocation looks up the most recent scheduled
time that has already passed (IST) and runs the sweep only if that slot hasn't been claimed yet.
So admins still change times from the web app, a quick check is all that happens on most
invocations, and a slot missed while the PC was off runs as soon as it's back on.

Every portal is crawled one after another under a single batch_id, exactly like the API's old
all-portals sweep, so batches and the dashboard read the results unchanged. Logs go to
`backend/logs/scraper-YYYY-MM-DD.log` (kept 14 days).
"""

import argparse
import asyncio
import logging
import os
import sys
import time
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

from sqlalchemy import text

from app.core.constants import AUTO_SCRAPE_PORTALS
from app.db.schema import ensure_scrape_schedule_settings
from app.db.session import get_conn

logger = logging.getLogger("mop_tracker.runner")

IST = ZoneInfo("Asia/Kolkata")
BACKEND_DIR = Path(__file__).resolve().parents[2]
LOG_DIR = BACKEND_DIR / "logs"
LOG_RETENTION_DAYS = 14
_SUMMARY_MAX_LEN = 500  # dbo.scrape_schedule_settings.last_run_summary


# ---------------------------------------------------------------------------- logging / locking


def _configure_logging() -> None:
    LOG_DIR.mkdir(exist_ok=True)
    cutoff = time.time() - LOG_RETENTION_DAYS * 86400
    for old in LOG_DIR.glob("scraper-*.log"):
        try:
            if old.stat().st_mtime < cutoff:
                old.unlink()
        except OSError:
            pass

    # One file per day, plain append: several runner processes (the 15-minute scheduled checks
    # and a long sweep) can write at once, which a rotating handler can't do safely on Windows.
    handlers: list[logging.Handler] = [
        logging.FileHandler(LOG_DIR / f"scraper-{datetime.now(IST):%Y-%m-%d}.log", encoding="utf-8")
    ]
    if sys.stdout is not None:  # None under pythonw.exe (how Task Scheduler launches it)
        sys.stdout.reconfigure(errors="replace")
        handlers.append(logging.StreamHandler(sys.stdout))
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
        handlers=handlers,
        force=True,
    )
    # Scrapy's own INFO output is mostly per-crawl setup noise; keep its once-a-minute progress line.
    logging.getLogger("scrapy").setLevel(logging.WARNING)
    logging.getLogger("scrapy.extensions.logstats").setLevel(logging.INFO)
    # scrapy-playwright stops its Windows loop thread with a Queue.join() task still pending, so
    # asyncio logs a harmless "Task was destroyed but it is pending!" ERROR after every portal.
    logging.getLogger("asyncio").addFilter(
        lambda record: not (record.getMessage().startswith("Task was destroyed") and "Queue.join" in record.getMessage())
    )


def _acquire_run_lock():
    """Returns an open, exclusively-locked file handle, or None if another run holds the lock.
    The OS releases the lock when this process exits, however it exits."""
    handle = open(LOG_DIR / "scraper.lock", "a+")
    try:
        if os.name == "nt":
            import msvcrt

            handle.seek(0)
            msvcrt.locking(handle.fileno(), msvcrt.LK_NBLCK, 1)
        else:
            import fcntl

            fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except OSError:
        handle.close()
        return None
    return handle


# ---------------------------------------------------------------------------- schedule state


def _read_schedule() -> tuple[bool, list[str], str | None]:
    with get_conn() as conn:
        row = conn.execute(
            text("SELECT enabled, times, last_run_slot FROM dbo.scrape_schedule_settings WHERE id = 1")
        ).fetchone()
    if row is None:
        return False, [], None
    times = sorted({t.strip() for t in (row.times or "").split(",") if t.strip()})
    return bool(row.enabled), times, row.last_run_slot


def latest_due_slot(times: list[str], now: datetime) -> datetime | None:
    """The most recent scheduled time at or before `now` (today's, else yesterday's last one)."""
    slots = []
    for day in (now.date() - timedelta(days=1), now.date()):
        for t in times:
            try:
                hour, minute = (int(part) for part in t.split(":"))
                slots.append(datetime(day.year, day.month, day.day, hour, minute, tzinfo=now.tzinfo))
            except ValueError:
                logger.warning("Ignoring invalid schedule time %r", t)
    past = [s for s in slots if s <= now]
    return max(past) if past else None


def _claim_slot(slot_key: str) -> bool:
    """Atomically marks `slot_key` as taken; False if it was already run (or is running)."""
    with get_conn() as conn:
        result = conn.execute(
            text(
                """
                UPDATE dbo.scrape_schedule_settings
                SET last_run_slot = :slot, last_run_status = 'RUNNING', last_run_started_at = GETDATE(),
                    last_run_finished_at = NULL, last_run_summary = NULL
                WHERE id = 1 AND (last_run_slot IS NULL OR last_run_slot <> :slot)
                """
            ),
            {"slot": slot_key},
        )
    return result.rowcount == 1


def _mark_manual_start() -> None:
    with get_conn() as conn:
        conn.execute(
            text(
                """
                UPDATE dbo.scrape_schedule_settings
                SET last_run_status = 'RUNNING', last_run_started_at = GETDATE(),
                    last_run_finished_at = NULL, last_run_summary = NULL
                WHERE id = 1
                """
            )
        )


def _mark_finished(status: str, summary: str) -> None:
    with get_conn() as conn:
        conn.execute(
            text(
                """
                UPDATE dbo.scrape_schedule_settings
                SET last_run_status = :status, last_run_finished_at = GETDATE(), last_run_summary = :summary
                WHERE id = 1
                """
            ),
            {"status": status, "summary": summary[:_SUMMARY_MAX_LEN]},
        )


def _clear_stale_running() -> None:
    # Called while holding the run lock, so a RUNNING status here belongs to a run that died
    # (PC shut down / crashed mid-sweep) rather than one still in progress.
    with get_conn() as conn:
        conn.execute(
            text(
                """
                UPDATE dbo.scrape_schedule_settings
                SET last_run_status = 'INTERRUPTED', last_run_finished_at = GETDATE()
                WHERE id = 1 AND last_run_status = 'RUNNING'
                """
            )
        )


# ---------------------------------------------------------------------------- crawling


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


class LogOnlyPipeline:
    """--dry-run replacement for MopTrackerPipeline: logs each item instead of inserting it."""

    def process_item(self, item, spider):
        from app.services.job_store import job_store

        row = dict(item)
        logger.info(
            "[dry-run] %s %s: %s price=%s mrp=%s seller=%s stock=%s",
            row.get("portal"), row.get("code"), row.get("scrap_status"), row.get("price_scraped"),
            row.get("mrp"), row.get("seller"), row.get("inventory_status"),
        )
        job_store.record_success(row.get("batch_id"), row)
        return item


def _install_reactor() -> None:
    from scrapy.utils.reactor import install_reactor
    from twisted.internet import error as twisted_error

    try:
        install_reactor("twisted.internet.asyncioreactor.AsyncioSelectorReactor")
    except twisted_error.ReactorAlreadyInstalledError:
        pass
    from twisted.internet import reactor

    # Our own asyncio loop drives the reactor, so reactor.run() is never called — but the reactor
    # must still be marked running, or its startup triggers never fire and its threadpool (used
    # for DNS resolution) never starts, leaving every plain-HTTP crawl stuck at 0 pages.
    if not reactor.running:
        reactor.startRunning(installSignalHandlers=False)


def _reset_playwright_loop_thread() -> None:
    """Lets the next crawl in this process start a fresh Playwright loop thread (Windows only).

    When a crawl's download handler closes, scrapy-playwright stops its Windows event-loop thread
    but leaves the dead loop/thread on the class, so the next crawl's start() sees them, skips
    starting a new one, and queues every Playwright call onto a stopped loop — the second portal
    of a sweep then hangs forever. Same private class utils.on_page_loop already relies on.
    """
    from scrapy_playwright._loop import _ThreadedLoopAdapter as adapter

    thread = getattr(adapter, "_thread", None)
    if thread is None or thread.is_alive():
        return
    adapter._loop.close()
    del adapter._loop
    del adapter._thread
    adapter._stop_events.clear()
    adapter._coro_queue = asyncio.Queue()  # the old queue is bound to the closed loop


async def _crawl_portals(batch_id: str, portal_records: dict[str, list[dict]], dry_run: bool) -> list[str]:
    from scrapy.crawler import CrawlerRunner
    from scrapy.utils.defer import deferred_to_future

    from app.scraping.settings import SCRAPY_SETTINGS
    from app.scraping.spiders.ajio_spider import AjioSpider
    from app.scraping.spiders.amazon_spider import AmazonSpider
    from app.scraping.spiders.flipkart_spider import FlipkartSpider
    from app.scraping.spiders.myntra_spider import MyntraSpider
    from app.scraping.spiders.snapdeal_spider import SnapdealSpider
    from app.services.job_store import job_store

    spiders = {
        "flipkart": FlipkartSpider,
        "amazon": AmazonSpider,
        "myntra": MyntraSpider,
        "ajio": AjioSpider,
        "snapdeal": SnapdealSpider,
    }
    settings = dict(SCRAPY_SETTINGS)
    if dry_run:
        settings["ITEM_PIPELINES"] = {f"{__name__}.LogOnlyPipeline": 300}

    _install_reactor()
    failures = []
    summaries = []
    for portal, records in portal_records.items():
        before = job_store.get(batch_id)
        started = time.monotonic()
        logger.info("%s: scraping %d products", portal, len(records))
        _reset_playwright_loop_thread()
        try:
            # A crash in one portal's crawl must not cancel the portals after it.
            await deferred_to_future(CrawlerRunner(settings).crawl(spiders[portal], records=records, batch_id=batch_id))
        except Exception:  # noqa: BLE001
            logger.exception("%s: crawl failed", portal)
            failures.append(portal)
        after = job_store.get(batch_id)
        saved = after["inserted"] - before["inserted"]
        errors = after["errors"] - before["errors"]
        minutes = (time.monotonic() - started) / 60
        line = f"{portal} {saved if not dry_run else after['done'] - before['done']}/{len(records)}"
        if errors:
            line += f" ({errors} errors)"
        if portal in failures:
            line += " (crawl failed)"
        logger.info("%s: done in %.1f min: %s", portal, minutes, line)
        summaries.append(line)
    if after.get("db_error"):
        logger.error("Last database insert error: %s", after["db_error"])
    return summaries if not failures else summaries + [f"FAILED: {', '.join(failures)}"]


def run_sweep(portals: list[str], limit: int | None, dry_run: bool) -> tuple[str, str]:
    """Scrapes `portals` one after another under one batch_id. Returns (status, summary)."""
    from app.services.job_store import job_store

    portal_records = {}
    for portal in portals:
        records = fetch_records_from_db(portal)
        if limit:
            records = records[:limit]
        if records:
            portal_records[portal] = records
        else:
            logger.info("%s: no products in dbo.mop_data, skipping", portal)
    total = sum(len(r) for r in portal_records.values())
    if not total:
        return "DONE", "No products to scrape"

    batch_id = job_store.create(total)
    logger.info("Batch %s: %d products across %s%s", batch_id, total, ", ".join(portal_records), " (dry run)" if dry_run else "")
    summaries = asyncio.run(
        _crawl_portals(batch_id, portal_records, dry_run),
        loop_factory=asyncio.SelectorEventLoop,  # Twisted's asyncio reactor needs a selector loop on Windows
    )
    status = "FAILED" if summaries and summaries[-1].startswith("FAILED") else "DONE"
    return status, "; ".join(summaries)


# ---------------------------------------------------------------------------- entry point


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m app.scraping.runner", description=__doc__.split("\n\n")[0])
    parser.add_argument("--scheduled", action="store_true", help="run only if a scheduled time (web app Auto-Scrape settings) is due")
    parser.add_argument("--portal", action="append", choices=AUTO_SCRAPE_PORTALS, help="portal to scrape (repeatable; default: all)")
    parser.add_argument("--limit", type=int, help="scrape at most N products per portal (for testing)")
    parser.add_argument("--dry-run", action="store_true", help="log results instead of saving them to the database")
    args = parser.parse_args(argv)

    _configure_logging()
    lock = _acquire_run_lock()
    if lock is None:
        logger.info("Another scrape run is still in progress; exiting.")
        return 0

    try:
        # Only the table this runner adds columns to; the API creates everything else on startup.
        with get_conn() as conn:
            ensure_scrape_schedule_settings(conn)
        _clear_stale_running()
        portals = args.portal or AUTO_SCRAPE_PORTALS
        record_state = not args.dry_run

        if args.scheduled:
            enabled, times, last_slot = _read_schedule()
            slot = latest_due_slot(times, datetime.now(IST)) if enabled else None
            if slot is None:
                logger.debug("No scheduled run is due (enabled=%s).", enabled)
                return 0
            slot_key = slot.strftime("%Y-%m-%d %H:%M")
            if slot_key == last_slot or not (args.dry_run or _claim_slot(slot_key)):
                return 0
            logger.info("Scheduled run for %s IST starting.", slot_key)
        elif record_state:
            _mark_manual_start()

        try:
            status, summary = run_sweep(portals, args.limit, args.dry_run)
        except Exception as exc:  # noqa: BLE001
            logger.exception("Scrape run failed")
            status, summary = "FAILED", f"{type(exc).__name__}: {exc}"
        if record_state:
            _mark_finished(status, summary)
        logger.info("Scrape run %s: %s", status, summary)
        return 0 if status == "DONE" else 1
    except Exception:  # noqa: BLE001 — under pythonw there is no console; make sure it's logged
        logger.exception("Scrape runner crashed")
        return 1
    finally:
        lock.close()


if __name__ == "__main__":
    exit_code = main()
    # Hard exit: the Twisted reactor is never run()/stopped here (asyncio drives it), so its
    # threadpool's non-daemon threads — and scrapy-playwright's event-loop thread on Windows —
    # would keep the interpreter alive forever after the work is done, leaving Task Scheduler's
    # instance "running" and blocking every later check. Everything is finished and logged here.
    logging.shutdown()
    os._exit(exit_code)
