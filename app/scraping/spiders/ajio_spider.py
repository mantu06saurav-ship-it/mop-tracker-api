"""Ajio PDP scraper.

Ajio sits behind an Akamai WAF that returns an Access Denied challenge to plain HTTP
requests, so this requires full browser automation with a realistic fingerprint (handled by
the shared Playwright context) rather than a simple GET.
"""

import scrapy

from app.scraping.items import ScrapedItem
from app.scraping.utils import base_result, parse_price, price_status
from app.services.job_store import job_store

_EVAL_JS = r"""
(requestedCode) => {
    const textOf = (el) => (el && el.textContent ? el.textContent.trim() : "");

    const numFrom = (raw) => {
        if (raw === null || raw === undefined) return null;
        const s = String(raw);
        const m = s.match(/[\d,]+(?:\.\d+)?/);
        if (!m) return null;
        return m[0].replace(/,/g, "");
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

    // ---- JSON-LD ----
    let group = null;
    let variant = null;
    try {
        const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
        for (const script of scripts) {
            let parsed;
            try {
                parsed = JSON.parse(script.textContent);
            } catch (e) {
                continue;
            }
            let candidates;
            if (Array.isArray(parsed)) {
                candidates = parsed;
            } else if (parsed && parsed["@graph"]) {
                candidates = parsed["@graph"];
            } else {
                candidates = [parsed];
            }
            for (const c of candidates) {
                if (c && c["@type"] && /product/i.test(c["@type"])) {
                    group = c;
                    break;
                }
            }
            if (group) break;
        }
    } catch (e) {
        // ignore
    }

    if (group && Array.isArray(group.hasVariant)) {
        variant = group.hasVariant.find((v) => String(v.sku) === String(requestedCode)) || null;
    }
    const ld = variant || group;

    if (ld) {
        result.title = ld.name || (group && group.name) || null;

        const offer = Array.isArray(ld.offers) ? ld.offers[0] : ld.offers;
        if (offer) {
            if (offer.price) result.price = String(offer.price);
            if (offer.highPrice) result.mrp = String(offer.highPrice);
            if (offer.availability) {
                result.inventory_status = /instock/i.test(offer.availability) ? "In Stock" : "Out of Stock";
            }
        }

        if (group && group.aggregateRating) {
            const agg = group.aggregateRating;
            if (agg.ratingValue) result.rating = String(agg.ratingValue);
            if (agg.reviewCount || agg.ratingCount) {
                result.reviews = String(agg.reviewCount || agg.ratingCount);
            }
        }

        const img = (variant && variant.image) || (group && group.image);
        if (img) {
            result.image_url = Array.isArray(img) ? img[0] : img;
        }
    }

    // ---- title fallback ----
    if (!result.title) {
        const og = document.querySelector('meta[property="og:title"]');
        if (og && og.content) {
            result.title = og.content;
        } else {
            for (const sel of [".prod-name", ".product-name", '[class*="prod-name"]', "h1"]) {
                const el = document.querySelector(sel);
                const t = textOf(el);
                if (t) {
                    result.title = t;
                    break;
                }
            }
        }
    }

    // ---- price fallback ----
    if (!result.price) {
        const metaPrice =
            document.querySelector('meta[property="product:price:amount"]') ||
            document.querySelector('meta[itemprop="price"]');
        if (metaPrice && metaPrice.content) {
            result.price = numFrom(metaPrice.content);
        }
    }
    if (!result.price) {
        for (const sel of [".prod-sp", ".price", '[class*="selling-price"]', '[class*="prod-sp"]']) {
            const el = document.querySelector(sel);
            const t = textOf(el);
            if (t) {
                result.price = numFrom(t);
                if (result.price) break;
            }
        }
    }
    if (!result.price) {
        const el = document.querySelector('[class*="price" i]');
        const t = textOf(el);
        if (t) result.price = numFrom(t);
    }

    // ---- mrp fallback ----
    if (!result.mrp) {
        const el = document.querySelector("s, strike, del, [style*='line-through']");
        const t = textOf(el);
        if (t) result.mrp = numFrom(t);
    }
    if (!result.mrp) {
        for (const sel of [".prod-cp", '[class*="prod-cp"]', '[class*="strike"]']) {
            const el = document.querySelector(sel);
            const t = textOf(el);
            if (t) {
                result.mrp = numFrom(t);
                if (result.mrp) break;
            }
        }
    }
    if (!result.mrp) {
        result.mrp = result.price;
    }

    // ---- rating fallback ----
    if (!result.rating) {
        const el = document.querySelector('[class*="rating" i]');
        const t = textOf(el);
        if (t) {
            const m = t.match(/([\d.]+)\s*(?:\/\s*5)?/);
            if (m) result.rating = m[1];
        }
    }

    // ---- reviews fallback ----
    if (!result.reviews) {
        const candidates = Array.from(document.querySelectorAll("*")).filter((el) => el.children.length === 0);
        for (const el of candidates) {
            const t = textOf(el);
            if (/rating/i.test(t) && /\d/.test(t)) {
                const m = t.match(/([\d,]+)\s*Ratings?/i);
                if (m) {
                    result.reviews = m[1];
                    break;
                }
            }
        }
    }

    // ---- seller ----
    let seller = null;
    const sellerEl = document.querySelector('[class*="seller" i]');
    if (sellerEl) {
        seller = textOf(sellerEl).replace(/^sold\s*by\s*[:\-]?\s*/i, "").trim();
    }
    result.seller = seller || "LIBERTY SHOES LIMITED";

    // ---- available sizes ----
    const sizeSet = new Set();
    const sizeEls = document.querySelectorAll(
        '[class*="size" i] button, [class*="size-box" i], [class*="size-chip" i]'
    );
    for (const el of sizeEls) {
        const t = textOf(el);
        if (t && t.length <= 12) sizeSet.add(t);
    }
    result.available_sizes = sizeSet.size ? Array.from(sizeSet).join(", ") : null;

    // ---- inventory status ----
    if (!result.inventory_status) {
        const bodyText = document.body.innerText || "";
        if (/out of stock|sold out/i.test(bodyText)) {
            result.inventory_status = "Out of Stock";
        } else {
            result.inventory_status = result.price ? "In Stock" : "Out of Stock";
        }
    }

    // ---- image fallback ----
    if (!result.image_url) {
        const og = document.querySelector('meta[property="og:image"]');
        if (og && og.content) result.image_url = og.content;
    }

    return result;
}
"""


class AjioSpider(scrapy.Spider):
    name = "ajio"

    custom_settings = {"DOWNLOAD_DELAY": 1.5, "RANDOMIZE_DOWNLOAD_DELAY": True}

    def __init__(self, records=None, batch_id=None, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.records = records or []
        self.batch_id = batch_id

    async def start(self):
        for record in self.records:
            code = record.get("code")
            url = f"https://www.ajio.com/p/{code}"
            yield scrapy.Request(
                url,
                callback=self.parse,
                errback=self.errback,
                meta={
                    "record": record,
                    "playwright": True,
                    "playwright_include_page": True,
                    "playwright_context": "default",
                },
                dont_filter=True,
            )

    async def parse(self, response):
        record = response.meta["record"]
        page = response.meta["playwright_page"]
        code = record.get("code")

        try:
            await page.wait_for_timeout(3000)
            await page.evaluate("window.scrollTo(0, document.body.scrollHeight/2)")
            await page.wait_for_timeout(1500)
        except Exception as exc:  # noqa: BLE001 — handled failure, not an errback case
            try:
                await page.close()
            except Exception:  # noqa: BLE001
                pass
            self.logger.warning("%s %s: page load timeout (%s)", self.name, code, exc)
            scraped = base_result(scrap_status="ERROR: Page load timeout")
            yield self._build_item(record, response, scraped)
            return

        try:
            scraped = await page.evaluate(_EVAL_JS, code)
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

        yield self._build_item(record, response, scraped)

    def _build_item(self, record, response, scraped):
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

    def errback(self, failure):
        record = failure.request.meta["record"]
        message = f"{self.name} {record.get('code')}: {failure.value}"
        self.logger.error(message)
        job_store.record_error(self.batch_id, message)
