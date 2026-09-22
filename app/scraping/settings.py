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
    # Node processes records one-at-a-time per job (a single shared browser page / http
    # session) — keep the same effectively-sequential behaviour rather than Scrapy's usual
    # high concurrency, so per-record delays behave the same way.
    "CONCURRENT_REQUESTS": 1,
    "CONCURRENT_REQUESTS_PER_DOMAIN": 1,
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
