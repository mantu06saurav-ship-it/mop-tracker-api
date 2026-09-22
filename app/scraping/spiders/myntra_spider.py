"""Myntra PDP scraper.

Myntra's PDP is a client-rendered SPA and the URL slug format varies (bare style id vs a
"/product/" prefixed path), so this requires full Playwright browser automation with a
two-pattern URL fallback rather than a single deterministic HTTP GET.
"""

import scrapy

from app.scraping.items import ScrapedItem
from app.scraping.utils import base_result, parse_price, price_status
from app.services.job_store import job_store

_EVAL_JS = r"""
() => {
    const textOf = (el) => (el && el.textContent ? el.textContent.trim() : "");

    const firstNonEmpty = (selectors) => {
        for (const sel of selectors) {
            const el = document.querySelector(sel);
            const t = textOf(el);
            if (t) return t;
        }
        return null;
    };

    const result = {
        title: null,
        price: null,
        mrp: null,
        rating: null,
        reviews: null,
        seller: null,
        available_sizes: null,
        inventory_status: null,
        image_url: null,
    };

    result.title = firstNonEmpty([".pdp-name", "h1.pdp-title", ".title-name", "h1"]);
    result.price = firstNonEmpty([".pdp-price strong", "strong.pdp-price", "span._30jeq3"]);

    // ---- mrp ----
    let mrp = null;
    const verbiageChildren = Array.from(document.querySelectorAll(".pdp-mrp-verbiage > div"));
    for (const child of verbiageChildren) {
        const normalized = textOf(child).replace(/\s+/g, " ").toLowerCase();
        if (normalized.startsWith("maximum retail price")) {
            const amtEl = child.querySelector(".pdp-mrp-verbiage-amt");
            const amtText = textOf(amtEl);
            const m = amtText.match(/[\d,]+(?:\.\d+)?/);
            if (m) {
                mrp = m[0].replace(/,/g, "");
            }
            break;
        }
    }
    if (!mrp) {
        mrp = firstNonEmpty([".pdp-mrp s", "s.pdp-mrp", ".original-price"]);
    }
    result.mrp = mrp || result.price;

    // ---- rating ----
    const ratingEl = document.querySelector(".index-overallRating, .rating-container");
    if (ratingEl) {
        const t = textOf(ratingEl);
        const m = t.match(/([\d.]+)/);
        if (m) result.rating = m[1];
    }

    // ---- reviews ----
    result.reviews = firstNonEmpty([".index-ratingsCount", ".rating-count"]);

    // ---- seller ----
    let seller = firstNonEmpty([".supplier-productSellerName", ".pdp-seller-name", ".supplier-name"]);
    if (!seller) {
        const scripts = Array.from(document.querySelectorAll("script"));
        for (const script of scripts) {
            const content = script.textContent || "";
            if (content.includes("sellerName")) {
                const m = content.match(/"sellerName"\s*:\s*"([^"]+)"/);
                if (m) {
                    seller = m[1];
                    break;
                }
            }
        }
    }
    result.seller = seller;

    // ---- available sizes ----
    const sizeSet = new Set();
    const containers = Array.from(document.querySelectorAll(".size-buttons-tipAndBtnContainer"));
    for (const container of containers) {
        const labelEl = container.querySelector(".size-buttons-unified-size");
        const label = textOf(labelEl);
        if (!label) continue;
        const button = container.querySelector("button");
        const disabled = button ? button.hasAttribute("disabled") : false;
        sizeSet.add(disabled ? `${label} (OOS)` : label);
    }
    result.available_sizes = sizeSet.size ? Array.from(sizeSet).join(", ") : null;

    // ---- inventory status ----
    result.inventory_status = result.price ? "In Stock" : "Out of Stock";

    // ---- image ----
    const og = document.querySelector('meta[property="og:image"]');
    result.image_url = og && og.content ? og.content : null;

    return result;
}
"""


class MyntraSpider(scrapy.Spider):
    name = "myntra"

    custom_settings = {"DOWNLOAD_DELAY": 1.5, "RANDOMIZE_DOWNLOAD_DELAY": True}

    def __init__(self, records=None, batch_id=None, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.records = records or []
        self.batch_id = batch_id

    def start_requests(self):
        for record in self.records:
            code = record.get("code")
            url = f"https://www.myntra.com/{code}"
            yield scrapy.Request(
                url,
                callback=self.parse,
                errback=self.errback_try_next_url,
                meta={
                    "record": record,
                    "url_attempt": 1,
                    "playwright": True,
                    "playwright_include_page": True,
                    "playwright_context": "default",
                },
                dont_filter=True,
            )

    def _next_url_request(self, record):
        code = record.get("code")
        url = f"https://www.myntra.com/product/{code}"
        return scrapy.Request(
            url,
            callback=self.parse,
            errback=self.errback_final,
            meta={
                "record": record,
                "url_attempt": 2,
                "playwright": True,
                "playwright_include_page": True,
                "playwright_context": "default",
            },
            dont_filter=True,
        )

    def _timeout_item(self, record):
        item = ScrapedItem(
            batch_id=self.batch_id,
            portal=self.name,
            code_type=record.get("code_type"),
            code=record.get("code"),
            sku=record.get("sku_code"),
            mop=record.get("mop"),
            title=None,
            price_scraped=None,
            mrp=None,
            rating=None,
            reviews=None,
            seller=None,
            product_url=None,
            image_url=None,
            inventory_status=None,
            scrap_status="ERROR: Page load timeout",
            price_status=price_status(None, parse_price(record.get("mop"))),
            available_sizes=None,
        )
        return item

    def errback_try_next_url(self, failure):
        record = failure.request.meta["record"]
        self.logger.warning(
            "%s %s: first URL pattern failed (%s), trying fallback pattern",
            self.name,
            record.get("code"),
            failure.value,
        )
        return self._next_url_request(record)

    def errback_final(self, failure):
        record = failure.request.meta["record"]
        self.logger.warning(
            "%s %s: fallback URL pattern also failed (%s)",
            self.name,
            record.get("code"),
            failure.value,
        )
        return self._timeout_item(record)

    async def parse(self, response):
        record = response.meta["record"]
        url_attempt = response.meta.get("url_attempt", 1)
        page = response.meta["playwright_page"]

        try:
            loaded_ok = True
            try:
                await page.wait_for_selector("body", timeout=15000)
            except Exception:  # noqa: BLE001
                loaded_ok = False

            if not loaded_ok:
                await page.close()
                if url_attempt == 1:
                    yield self._next_url_request(record)
                else:
                    yield self._timeout_item(record)
                return

            await page.wait_for_timeout(3000)
            await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
            await page.wait_for_timeout(2000)

            scraped = await page.evaluate(_EVAL_JS)
            scraped["product_url"] = page.url

            title = scraped.get("title")
            price_raw = scraped.get("price")
            if title and price_raw:
                scraped["scrap_status"] = "SUCCESS"
            elif title or price_raw:
                scraped["scrap_status"] = "PARTIAL"
            else:
                scraped["scrap_status"] = "EMPTY"
        finally:
            try:
                await page.close()
            except Exception:  # noqa: BLE001
                pass

        price = parse_price(scraped.get("price"))
        item = ScrapedItem(
            batch_id=self.batch_id,
            portal=self.name,
            code_type=record.get("code_type"),
            code=record.get("code"),
            sku=record.get("sku_code"),
            mop=record.get("mop"),
            title=scraped.get("title"),
            price_scraped=price,
            mrp=parse_price(scraped.get("mrp")),
            rating=scraped.get("rating"),
            reviews=scraped.get("reviews"),
            seller=scraped.get("seller"),
            product_url=scraped.get("product_url") or response.url,
            image_url=scraped.get("image_url"),
            inventory_status=scraped.get("inventory_status"),
            scrap_status=scraped["scrap_status"],
            price_status=price_status(price, parse_price(record.get("mop"))),
            available_sizes=scraped.get("available_sizes"),
        )
        yield item

    def errback(self, failure):
        # Kept for contract-parity; Myntra's two url_attempt-specific errbacks above are used
        # for actual requests, but a shared errback name matches the common spider contract.
        record = failure.request.meta["record"]
        message = f"{self.name} {record.get('code')}: {failure.value}"
        self.logger.error(message)
        job_store.record_error(self.batch_id, message)
