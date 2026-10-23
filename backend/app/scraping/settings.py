"""Scrapy settings, used as a plain dict passed to CrawlerRunner (no scrapy.cfg project needed
since crawls are launched in-process from the FastAPI app, not via the `scrapy` CLI).

BROWSER_LAUNCH_ARGS mirrors the Node app's Render-free-tier hardening: `--disable-dev-shm-usage`
avoids Chromium crashing on containers with a tiny /dev/shm, `--no-sandbox` is required because
Render doesn't grant the sandbox's extra kernel privileges.
"""

BROWSER_LAUNCH_ARGS = [
    "--disable-blink-features=AutomationControlled",
    "--disable-dev-shm-usage",
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-gpu",
]

SCRAPY_SETTINGS = {
    "BOT_NAME": "mop_tracker",
    "ROBOTSTXT_OBEY": False,
    "TWISTED_REACTOR": "twisted.internet.asyncioreactor.AsyncioSelectorReactor",
    "LOG_LEVEL": "INFO",
    # Strictly one-at-a-time (the Node behaviour) spent most of each ~10s product page idle
    # waiting on render settles, making a full sweep take hours. A few overlapping pages keep the
    # crawl polite — each spider's DOWNLOAD_DELAY still spaces out request *starts* per domain —
    # while cutting wall-clock time several-fold. Also sizes each browser context's page pool
    # (PLAYWRIGHT_MAX_PAGES_PER_CONTEXT defaults to CONCURRENT_REQUESTS).
    "CONCURRENT_REQUESTS": 4,
    "CONCURRENT_REQUESTS_PER_DOMAIN": 4,
    "RETRY_ENABLED": True,
    "RETRY_TIMES": 2,
    "ITEM_PIPELINES": {
        "app.scraping.pipelines.MopTrackerPipeline": 300,
    },
    "DOWNLOAD_HANDLERS": {
        "http": "scrapy_playwright.handler.ScrapyPlaywrightDownloadHandler",
        "https": "scrapy_playwright.handler.ScrapyPlaywrightDownloadHandler",
    },
    "PLAYWRIGHT_ABORT_REQUEST": "app.scraping.utils.should_abort_request",
    "PLAYWRIGHT_BROWSER_TYPE": "chromium",
    "PLAYWRIGHT_LAUNCH_OPTIONS": {
        "headless": True,
        # Plain `headless: True` runs Playwright's stripped-down "chromium-headless-shell", whose
        # fingerprint Akamai recognises: Ajio answers it with 403 Access Denied on every product.
        # The "chromium" channel runs the full Chromium build in new-headless mode instead, which
        # is served the real page (same binary `playwright install chromium` already ships).
        "channel": "chromium",
        "args": BROWSER_LAUNCH_ARGS,
    },
    "PLAYWRIGHT_CONTEXTS": {
        "default": {
            "viewport": {"width": 1366, "height": 768},
            "locale": "en-IN",
            "timezone_id": "Asia/Kolkata",
            "user_agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
            ),
        }
    },
    "PLAYWRIGHT_DEFAULT_NAVIGATION_TIMEOUT": 30000,
    "DOWNLOAD_TIMEOUT": 30,
    "USER_AGENT": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ),
}
