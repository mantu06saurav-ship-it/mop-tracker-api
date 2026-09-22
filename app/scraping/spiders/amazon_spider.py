"""Amazon.in PDP scraper.

Amazon serves a fully server-rendered HTML page for a plain, unauthenticated GET, so a
lightweight HTTP request (rotating desktop UA + India locale headers) is enough — no browser
automation needed, provided we handle occasional bot-check responses (429/503/403, CAPTCHA).
"""

import re

import scrapy

from app.scraping.items import ScrapedItem
from app.scraping.utils import base_result, clean_seller_text, parse_price, price_status
from app.services.job_store import job_store

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/121.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36",
]

MAX_RETRIES = 2  # 3 attempts total, matching the Node scraper's retry budget

_NUMERIC_CLEAN_RE = re.compile(r"[^\d.]")


def _random_headers():
    import random

    return {
        "User-Agent": random.choice(USER_AGENTS),
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "en-IN,en;q=0.9",
        "Referer": "https://www.amazon.in/",
    }


class AmazonSpider(scrapy.Spider):
    name = "amazon"

    custom_settings = {"DOWNLOAD_DELAY": 1.0, "RANDOMIZE_DOWNLOAD_DELAY": True}

    def __init__(self, records=None, batch_id=None, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.records = records or []
        self.batch_id = batch_id

    async def start(self):
        for record in self.records:
            code = record.get("code")
            url = f"https://www.amazon.in/dp/{code}"
            yield scrapy.Request(
                url,
                callback=self.parse,
                errback=self.errback,
                headers=_random_headers(),
                meta={"record": record, "retry_count": 0},
                dont_filter=True,
            )

    def _yield_item(self, record, response, scraped):
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
        return item

    def parse(self, response):
        record = response.meta["record"]
        retry_count = response.meta.get("retry_count", 0)

        if response.status in (429, 503, 403):
            if retry_count < MAX_RETRIES:
                yield scrapy.Request(
                    response.url,
                    callback=self.parse,
                    errback=self.errback,
                    headers=_random_headers(),
                    meta={"record": record, "retry_count": retry_count + 1},
                    dont_filter=True,
                )
                return
            status_label = "Bot blocked (503)" if response.status == 503 else f"HTTP {response.status}"
            yield self._yield_item(record, response, base_result(scrap_status=f"ERROR: {status_label}"))
            return

        if response.status != 200:
            yield self._yield_item(record, response, base_result(scrap_status=f"ERROR: HTTP {response.status}"))
            return

        body = response.text
        if "Robot Check" in body or "Enter the characters" in body or "Sorry, we just need" in body:
            yield self._yield_item(record, response, base_result(scrap_status="ERROR: CAPTCHA detected"))
            return

        scraped = self._extract(response)
        yield self._yield_item(record, response, scraped)

    def _extract(self, response):
        def first_valid(selectors, min_len=0):
            for sel in selectors:
                for text in response.css(sel).getall():
                    t = text.strip()
                    if t and len(t) > min_len:
                        return t
            return None

        title = first_valid(["#productTitle::text", "#title span::text", "h1.a-size-large::text"], min_len=5)

        price_raw = None
        for sel in [
            ".priceToPay .a-price-whole",
            ".priceToPay .a-offscreen",
            "#corePriceDisplay_desktop_feature_div .a-price .a-offscreen",
        ]:
            for text in response.css(f"{sel}::text").getall():
                cleaned = _NUMERIC_CLEAN_RE.sub("", text.strip())
                if cleaned and cleaned != ".":
                    try:
                        float(cleaned)
                    except ValueError:
                        continue
                    price_raw = text.strip()
                    break
            if price_raw:
                break
        price_val = parse_price(price_raw)

        mrp_raw = None
        for sel in [".basisPrice .a-offscreen", ".a-text-price .a-offscreen"]:
            for text in response.css(f"{sel}::text").getall():
                candidate = parse_price(text.strip())
                if candidate is not None and (price_val is None or candidate >= price_val):
                    mrp_raw = text.strip()
                    break
            if mrp_raw:
                break
        mrp_val = mrp_raw if mrp_raw is not None else price_raw

        availability_raw = response.css("#availability span::text").get()
        inventory_status = None
        if availability_raw:
            availability_raw = availability_raw.strip()
            if re.search(r"in stock", availability_raw, re.IGNORECASE):
                inventory_status = "In Stock"
            elif re.search(r"out of stock", availability_raw, re.IGNORECASE):
                inventory_status = "Out of Stock"
            else:
                inventory_status = availability_raw
        if not inventory_status and response.css("#add-to-cart-button").get():
            inventory_status = "In Stock"

        rating = None
        rating_title = response.css("#acrPopover::attr(title)").get()
        if rating_title:
            m = re.search(r"(\d+\.?\d*)\s*out of\s*5", rating_title)
            if m:
                rating = m.group(1)

        reviews = response.css("#acrCustomerReviewText::text").get()
        if reviews:
            reviews = reviews.strip()

        seller = first_valid(["#sellerProfileTriggerId::text", "#merchant-info a::text"], min_len=1)
        if seller and not (2 <= len(seller) <= 120):
            seller = None
        seller = clean_seller_text(seller) if seller else seller

        image_url = (
            response.css('meta[property="og:image"]::attr(content)').get()
            or response.css("#landingImage::attr(src)").get()
            or response.css("#imgTagWrapperId img::attr(src)").get()
        )

        return base_result(
            title=title,
            price=price_raw,
            mrp=mrp_val,
            rating=rating,
            reviews=reviews,
            seller=seller,
            image_url=image_url,
            inventory_status=inventory_status,
            scrap_status="SUCCESS" if title else "EMPTY",
        )

    def errback(self, failure):
        record = failure.request.meta["record"]
        message = f"{self.name} {record.get('code')}: {failure.value}"
        self.logger.error(message)
        job_store.record_error(self.batch_id, message)
