"""Snapdeal PDP scraper.

Snapdeal serves fully server-rendered HTML for its product pages and its routing ignores the
slug prefix before the pog-id, so a single plain HTTP GET (rotating UA only) is enough — no
browser automation or retry loop needed.
"""

import re

import scrapy

from app.scraping.items import ScrapedItem
from app.scraping.utils import base_result, parse_price, price_status
from app.services.job_store import job_store

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/91.0.4472.124 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36",
]

_NUM_RE = re.compile(r"[\d,]+(?:\.\d+)?")


class SnapdealSpider(scrapy.Spider):
    name = "snapdeal"

    custom_settings = {"DOWNLOAD_DELAY": 1.0, "RANDOMIZE_DOWNLOAD_DELAY": True}

    def __init__(self, records=None, batch_id=None, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.records = records or []
        self.batch_id = batch_id

    async def start(self):
        import random

        for record in self.records:
            code = record.get("code")
            url = f"https://www.snapdeal.com/product/p/{code}"
            yield scrapy.Request(
                url,
                callback=self.parse,
                errback=self.errback,
                headers={"User-Agent": random.choice(USER_AGENTS)},
                meta={"record": record},
                dont_filter=True,
            )

    def parse(self, response):
        record = response.meta["record"]

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

        mrp_raw = response.css("div.pdpCutPrice::text").get()
        mrp = None
        if mrp_raw:
            m = _NUM_RE.search(mrp_raw)
            if m:
                mrp = m.group(0).replace(",", "")

        price = response.css("span.payBlkBig::text").get()

        rating = response.css("span.avrg-rating::text").get()
        rating = rating.strip() if rating else None

        reviews = response.css("span.total-rating.showRatingTooltip::text").get()
        reviews = reviews.strip() if reviews else None

        sizes = response.css("div.attr-val::text").getall()
        sizes = [s.strip() for s in sizes if s.strip()]
        available_sizes = ", ".join(sizes) if sizes else None

        seller_full = " ".join(t.strip() for t in response.css(".pdp-e-seller-info-name ::text").getall() if t.strip())
        seller_store = " ".join(
            t.strip() for t in response.css(".pdp-e-seller-info-name .pdp-e-seller-info-name-store ::text").getall() if t.strip()
        )
        seller = None
        if seller_full:
            seller = seller_full
            if seller_store:
                seller = seller.replace(seller_store, "").strip()
            seller = seller or None

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
