"""Myntra PDP scraper.

Myntra's bot protection now rejects headless Chromium outright (every navigation fails with
net::ERR_HTTP2_PROTOCOL_ERROR, with or without a spoofed UA or the real Chrome channel), so the
old Playwright/DOM approach recorded nothing but "Page load timeout" rows. A plain HTTP GET, on
the other hand, is served the full server-rendered PDP, which embeds the page's entire product
state as JSON in `window.__myx = {...}` — title, price, MRP, ratings, seller and per-size stock.
Parsing that JSON is faster and steadier than scraping the DOM, and needs no browser at all.
"""

import json
import random

import scrapy

from app.scraping.items import ScrapedItem
from app.scraping.utils import base_result, parse_price, price_status
from app.services.job_store import job_store

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/141.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/140.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/141.0.0.0 Safari/537.36",
]

MAX_RETRIES = 2  # 3 attempts total, same budget as the other spiders

# Let non-2xx responses reach parse() (Scrapy's HttpErrorMiddleware drops them otherwise), so a
# block is retried and still recorded as an ERROR row instead of vanishing from the batch.
HANDLED_STATUSES = [403, 404, 429, 500, 502, 503]

_STATE_MARKER = "window.__myx = "


def _random_headers():
    return {
        "User-Agent": random.choice(USER_AGENTS),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-IN,en;q=0.9",
    }


def _extract_pdp_data(body: str) -> dict | None:
    start = body.find(_STATE_MARKER)
    if start == -1:
        return None
    try:
        state, _ = json.JSONDecoder().raw_decode(body, start + len(_STATE_MARKER))
    except ValueError:
        return None
    pdp = state.get("pdpData") if isinstance(state, dict) else None
    return pdp if isinstance(pdp, dict) else None


def _ratings_count_text(count) -> str | None:
    """Formats like Myntra's own PDP label ("525 Ratings", "1.7k Ratings"), which is what the
    DOM scraper used to store in `reviews`."""
    if not isinstance(count, (int, float)) or count <= 0:
        return None
    if count < 1000:
        return f"{int(count)} Ratings"
    return f"{count / 1000:.1f}".rstrip("0").rstrip(".") + "k Ratings"


class MyntraSpider(scrapy.Spider):
    name = "myntra"
    handle_httpstatus_list = HANDLED_STATUSES

    custom_settings = {"DOWNLOAD_DELAY": 1.0, "RANDOMIZE_DOWNLOAD_DELAY": True}

    def __init__(self, records=None, batch_id=None, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.records = records or []
        self.batch_id = batch_id

    async def start(self):
        for record in self.records:
            code = str(record.get("code") or "").strip()
            yield scrapy.Request(
                f"https://www.myntra.com/{code}",
                callback=self.parse,
                errback=self.errback,
                headers=_random_headers(),
                meta={"record": record, "retry_count": 0},
                dont_filter=True,
            )

    def _yield_item(self, record, response, scraped):
        price = parse_price(scraped.get("price"))
        return ScrapedItem(
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

    def parse(self, response):
        record = response.meta["record"]
        retry_count = response.meta.get("retry_count", 0)

        if response.status in (429, 503, 403):
            if retry_count < MAX_RETRIES:
                yield response.request.replace(
                    headers=_random_headers(),
                    meta={"record": record, "retry_count": retry_count + 1},
                )
                return
            status_label = "Bot blocked (403)" if response.status == 403 else f"HTTP {response.status}"
            yield self._yield_item(record, response, base_result(scrap_status=f"ERROR: {status_label}"))
            return

        if response.status != 200:
            yield self._yield_item(record, response, base_result(scrap_status=f"ERROR: HTTP {response.status}"))
            return

        pdp = _extract_pdp_data(response.text)
        if pdp is None:
            # Myntra answers an unknown/delisted style id with a normal 200 page that simply has
            # no product state in it.
            yield self._yield_item(record, response, base_result(scrap_status="ERROR: Product not found"))
            return

        yield self._yield_item(record, response, self._extract(response, pdp))

    def _extract(self, response, pdp):
        selected_seller = pdp.get("selectedSeller") or {}
        price_info = pdp.get("price") or {}

        # The PDP heading shows the brand and the product name on separate lines, and the old DOM
        # scraper stored only the product-name line, so drop the brand prefix to keep titles
        # consistent with previously stored rows.
        title = (pdp.get("name") or "").strip() or None
        brand = ((pdp.get("brand") or {}).get("name") or "").strip()
        if title and brand and title.lower().startswith(brand.lower() + " "):
            title = title[len(brand) + 1 :].strip() or title

        price = selected_seller.get("discountedPrice") or price_info.get("discounted")
        mrp = pdp.get("mrp") or price_info.get("mrp") or price

        ratings = pdp.get("ratings") or {}
        average = ratings.get("averageRating")
        rating = f"{average:.1f}" if isinstance(average, (int, float)) and average > 0 else None

        sizes = []
        for size in pdp.get("sizes") or []:
            label = (size.get("label") or "").strip()
            if label:
                sizes.append(label if size.get("available") else f"{label} (OOS)")

        out_of_stock = (pdp.get("flags") or {}).get("outOfStock")
        if out_of_stock is None:
            out_of_stock = price is None
        image_url = response.css('meta[property="og:image"]::attr(content)').get()

        if title and price is not None:
            scrap_status = "SUCCESS"
        elif title or price is not None:
            scrap_status = "PARTIAL"
        else:
            scrap_status = "EMPTY"

        return base_result(
            title=title,
            price=price,
            mrp=mrp,
            rating=rating,
            reviews=_ratings_count_text(ratings.get("totalCount")),
            seller=selected_seller.get("sellerName"),
            product_url=response.url,
            image_url=image_url,
            inventory_status="Out of Stock" if out_of_stock else "In Stock",
            available_sizes=", ".join(sizes) or None,
            scrap_status=scrap_status,
        )

    def errback(self, failure):
        record = failure.request.meta["record"]
        message = f"{self.name} {record.get('code')}: {failure.value}"
        self.logger.error(message)
        job_store.record_error(self.batch_id, message)
