"""Snapdeal PDP scraper.

Snapdeal serves fully server-rendered HTML for its product pages and its routing ignores the
slug prefix before the pog-id, so a single plain HTTP GET (rotating UA only) is enough — no
browser automation needed, just a short retry loop for throttling responses.
"""

import random
import re

import scrapy

from app.scraping.items import ScrapedItem
from app.scraping.utils import base_result, parse_price, price_status
from app.services.job_store import job_store

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/141.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/140.0.0.0 Safari/537.36",
]

MAX_RETRIES = 2  # 3 attempts total, same budget as the other spiders

# Let non-2xx responses reach parse() (Scrapy's HttpErrorMiddleware drops them otherwise), so a
# throttled product is retried and a dead pog-id is still recorded as an ERROR row instead of
# vanishing from the batch.
HANDLED_STATUSES = [403, 404, 429, 500, 502, 503]

_NUM_RE = re.compile(r"[\d,]+(?:\.\d+)?")


def _random_headers():
    return {
        "User-Agent": random.choice(USER_AGENTS),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-IN,en;q=0.9",
    }


class SnapdealSpider(scrapy.Spider):
    name = "snapdeal"
    handle_httpstatus_list = HANDLED_STATUSES

    custom_settings = {"DOWNLOAD_DELAY": 1.0, "RANDOMIZE_DOWNLOAD_DELAY": True}

    def __init__(self, records=None, batch_id=None, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.records = records or []
        self.batch_id = batch_id

    async def start(self):
        for record in self.records:
            code = record.get("code")
            url = f"https://www.snapdeal.com/product/p/{code}"
            yield scrapy.Request(
                url,
                callback=self.parse,
                errback=self.errback,
                headers=_random_headers(),
                meta={"record": record, "retry_count": 0},
                dont_filter=True,
            )

    def parse(self, response):
        record = response.meta["record"]
        retry_count = response.meta.get("retry_count", 0)

        if response.status in (429, 503, 403) and retry_count < MAX_RETRIES:
            yield response.request.replace(
                headers=_random_headers(),
                meta={"record": record, "retry_count": retry_count + 1},
            )
            return

        if response.status != 200:
            scraped = base_result(scrap_status=f"ERROR: HTTP {response.status}")
        else:
            scraped = self._extract(response)

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

    def _extract(self, response):
        title = response.css("h1.pdp-e-i-head::text").get()
        title = title.strip() if title else None

        # The amount is a bare text node *after* the "MRP" label div (`MRP Rs. 2,999 (Inclusive
        # of all taxes)`), so read all of the block's text, not just its first (blank) node.
        mrp_raw = " ".join(response.css("div.pdpCutPrice ::text").getall())
        mrp = None
        m = _NUM_RE.search(mrp_raw)
        if m:
            mrp = m.group(0).replace(",", "")

        price = response.css("span.payBlkBig::text").get()

        rating = response.css("span.avrg-rating::text").get()
        rating = rating.strip() if rating else None

        reviews = response.css("span.total-rating.showRatingTooltip::text").get()
        reviews = reviews.strip() if reviews else None

        # Only the size chips (the colour swatches share the `attr-val` class); `data-sold` marks
        # a sold-out size.
        sizes = []
        for chip in response.css("div.attr-squared"):
            label = (chip.css(".attr-val::text").get() or "").strip()
            if label:
                sizes.append(f"{label} (OOS)" if chip.attrib.get("data-sold") == "true" else label)
        available_sizes = ", ".join(sizes) if sizes else None

        # The seller name link and the "View Store" link both carry `pdp-e-seller-info-name`;
        # the store link additionally has `pdp-e-seller-info-name-store` on the same element.
        seller = " ".join(
            t.strip()
            for t in response.css(
                ".pdp-e-seller-info-name:not(.pdp-e-seller-info-name-store) ::text"
            ).getall()
            if t.strip()
        ) or None

        image_url = response.css('meta[property="og:image"]::attr(content)').get()

        has_buy_link = bool(response.css(".buy-button-container .buyLink").get())
        if has_buy_link:
            inventory_status = "In Stock"
        elif re.search(r"sold\s+out", response.text, re.IGNORECASE):
            inventory_status = "Out of Stock"
        else:
            inventory_status = "In Stock" if price else "Out of Stock"

        return base_result(
            title=title,
            price=price,
            mrp=mrp,
            rating=rating,
            reviews=reviews,
            seller=seller,
            image_url=image_url,
            inventory_status=inventory_status,
            available_sizes=available_sizes,
            scrap_status="SUCCESS" if title else "EMPTY",
        )

    def errback(self, failure):
        record = failure.request.meta["record"]
        message = f"{self.name} {record.get('code')}: {failure.value}"
        self.logger.error(message)
        job_store.record_error(self.batch_id, message)
