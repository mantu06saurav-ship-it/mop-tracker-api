"""Bridges FastAPI's asyncio event loop to Scrapy/Twisted, in-process (no subprocess) — the
Python equivalent of the Node app's fire-and-forget `runScrapeJob()`.

Scrapy is normally driven by its own CLI/reactor lifecycle; running a single crawl from inside
an already-running asyncio app requires installing Twisted's asyncio reactor up front and using
`CrawlerRunner` (which does not manage the reactor loop itself) instead of `CrawlerProcess`
(which does, and can only be used once per process).
"""

import logging

from scrapy.crawler import CrawlerRunner
from scrapy.utils.defer import deferred_to_future
from scrapy.utils.reactor import install_reactor
from twisted.internet import error as twisted_error

from app.scraping.settings import SCRAPY_SETTINGS
from app.scraping.spiders.ajio_spider import AjioSpider
from app.scraping.spiders.amazon_spider import AmazonSpider
from app.scraping.spiders.flipkart_spider import FlipkartSpider
from app.scraping.spiders.myntra_spider import MyntraSpider
from app.scraping.spiders.snapdeal_spider import SnapdealSpider
from app.services.job_store import job_store

logger = logging.getLogger("mop_tracker.orchestrator")

SPIDER_MAP = {
    "flipkart": FlipkartSpider,
    "amazon": AmazonSpider,
    "myntra": MyntraSpider,
    "ajio": AjioSpider,
    "snapdeal": SnapdealSpider,
}

_reactor_ready = False


def ensure_reactor_installed() -> None:
    global _reactor_ready
    if _reactor_ready:
        return
    try:
        install_reactor("twisted.internet.asyncioreactor.AsyncioSelectorReactor")
    except twisted_error.ReactorAlreadyInstalledError:
        pass
    _reactor_ready = True


async def run_scrape_job(job_id: str, portal: str, records: list[dict]) -> None:
    """Whole-crawl try/except mirrors the Node app's outer try/catch/finally around
    `runScrapeJob` — if Scrapy/Playwright fails to even start (e.g. the Chromium binary isn't
    installed), the job is marked FAILED instead of raising out of a fire-and-forget task,
    which previously (before that Node fix) could crash the whole process.
    """
    ensure_reactor_installed()
    job_store.set_status(job_id, "RUNNING")

    spider_cls = SPIDER_MAP.get(portal)
    if spider_cls is None:
        job_store.set_status(job_id, "FAILED", last_error=f'No scraper registered for portal "{portal}".')
        return

    try:
        runner = CrawlerRunner(SCRAPY_SETTINGS)
        deferred = runner.crawl(spider_cls, records=records, batch_id=job_id)
        await deferred_to_future(deferred)
        job_store.set_status(job_id, "DONE")
    except Exception as exc:  # noqa: BLE001 — one job's crawl-start failure must not affect others
        logger.exception("Scrape job %s (%s) failed", job_id, portal)
        job_store.set_status(job_id, "FAILED", last_error=str(exc))
