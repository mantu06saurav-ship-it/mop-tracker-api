"""Flipkart PDP scraper.

Flipkart's product page is a heavy client-rendered React app whose price/rating/seller
blocks arrive via secondary XHRs after the initial HTML, so this spider needs full
Playwright browser automation (JS execution + settle waits) rather than a plain HTTP GET.
"""

import scrapy

from app.scraping.items import ScrapedItem
from app.scraping.utils import base_result, parse_price, price_status
from app.services.job_store import job_store

_EVAL_JS = r"""
() => {
    const cleanSeller = (raw) => {
        if (!raw) return null;
        let s = String(raw).trim();
        s = s.replace(/^(Fulfilled by|Sold by)\s+/i, "");
        const m = s.match(/\d\.\d/);
        if (m) s = s.slice(0, m.index).trim();
        s = s.replace(/\s*See other sellers.*$/i, "");
        s = s.trim();
        return s || null;
    };

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
        inventory_status: null,
        image_url: null,
    };

    // ---- title ----
    result.title = firstNonEmpty(["span.VU-ZEz", "span.B_NuCI", "h1"]);

    // ---- price ----
    let priceEl = null;
    for (const sel of ["div.v1zwn21l.v1zwn20", "div.Nx9bqj", "div._30jeq3"]) {
        const el = document.querySelector(sel);
        if (el && textOf(el)) {
            priceEl = el;
            result.price = textOf(el);
            break;
        }
    }

    // ---- JSON-LD ----
    let ldProduct = null;
    try {
        const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
        for (const script of scripts) {
            let parsed;
            try {
                parsed = JSON.parse(script.textContent);
            } catch (e) {
                continue;
            }
            const candidates = Array.isArray(parsed) ? parsed : [parsed];
            for (const c of candidates) {
                if (c && (c["@type"] === "Product" || c["@type"] === "product")) {
                    ldProduct = c;
                    break;
                }
            }
            if (ldProduct) break;
        }
    } catch (e) {
        // ignore
    }

    if (ldProduct) {
        const offers = ldProduct.offers || {};
        if (!result.price && offers.price) result.price = String(offers.price);
        if (offers.highPrice) result.mrp = String(offers.highPrice);
        if (offers.seller && offers.seller.name) result.seller = cleanSeller(offers.seller.name);
        if (offers.availability) {
            result.inventory_status = /instock/i.test(offers.availability) ? "In Stock" : "Out of Stock";
        }
        const agg = ldProduct.aggregateRating;
        if (agg) {
            if (agg.ratingValue) result.rating = String(agg.ratingValue);
            if (agg.reviewCount || agg.ratingCount) {
                result.reviews = String(agg.reviewCount || agg.ratingCount);
            }
        }
        if (ldProduct.image) {
            result.image_url = Array.isArray(ldProduct.image) ? ldProduct.image[0] : ldProduct.image;
        }
    }

    // ---- mrp helpers ----
    const priceNum = result.price ? parseFloat(String(result.price).replace(/[^\d.]/g, "")) : null;
    const validateMrp = (mrpVal) => {
        const n = parseFloat(String(mrpVal).replace(/[^\d.]/g, ""));
        if (!priceNum || !n || n <= priceNum) return null;
        return String(mrpVal);
    };
    if (result.mrp) {
        const v = validateMrp(result.mrp);
        result.mrp = v;
    }

    // ---- mrp direct selector ----
    if (!result.mrp) {
        const el = document.querySelector("div.v1zwn21m");
        const t = textOf(el).replace(/[₹,\s]/g, "");
        if (t && /^\d{2,}$/.test(t)) {
            const v = validateMrp(t);
            if (v) result.mrp = v;
        }
    }

    // ---- mrp scoped ancestor fallback ----
    if (!result.mrp && priceEl) {
        let scope = priceEl;
        let candidates = [];
        let pctMatch = null;
        for (let level = 0; level < 4 && scope; level++) {
            scope = scope.parentElement;
            if (!scope) break;
            const leaves = Array.from(scope.querySelectorAll("div, span")).filter((el) => el.children.length === 0);
            for (const el of leaves) {
                const style = window.getComputedStyle(el);
                const t = textOf(el);
                if (style.textDecorationLine && style.textDecorationLine.includes("line-through") && /^₹?[\d,]+$/.test(t)) {
                    candidates.push(t);
                }
            }
            if (!pctMatch) {
                const scopeText = scope.textContent || "";
                const m = scopeText.match(/(\d{1,3})\s*%/);
                if (m) {
                    const pct = parseInt(m[1], 10);
                    if (pct > 0 && pct < 95) pctMatch = pct;
                }
            }
            if (candidates.length) break;
        }
        if (candidates.length) {
            if (pctMatch && priceNum) {
                const expectedMrp = priceNum / (1 - pctMatch / 100);
                let best = null;
                let bestDiff = Infinity;
                for (const c of candidates) {
                    const n = parseFloat(c.replace(/[^\d.]/g, ""));
                    if (!n) continue;
                    const diff = Math.abs(n - expectedMrp) / expectedMrp;
                    if (diff <= 0.15 && diff < bestDiff) {
                        best = c;
                        bestDiff = diff;
                    }
                }
                result.mrp = best ? validateMrp(best) : validateMrp(candidates[0]);
            } else {
                result.mrp = validateMrp(candidates[0]);
            }
        }
    }

    // ---- mrp legacy <s> fallback ----
    if (!result.mrp && priceEl) {
        const container = priceEl.closest("div");
        const scope = container ? container.parentElement : document.body;
        if (scope) {
            const sTags = Array.from(scope.querySelectorAll("s"));
            for (const s of sTags) {
                const t = textOf(s).replace(/[₹,\s]/g, "");
                if (/^\d{2,}$/.test(t)) {
                    const v = validateMrp(t);
                    if (v) {
                        result.mrp = v;
                        break;
                    }
                }
            }
        }
    }

    // ---- rating fallback ----
    if (!result.rating) {
        const leaves = Array.from(document.querySelectorAll("div, span")).filter((el) => el.children.length === 0);
        let found = null;
        for (const el of leaves) {
            const t = textOf(el);
            if (/^\d(\.\d)?$/.test(t)) {
                const n = parseFloat(t);
                if (n >= 1 && n <= 5) {
                    const parentHtml = el.parentElement ? el.parentElement.innerHTML : "";
                    if (parentHtml.includes("★") || /rating/i.test(parentHtml) || /star/i.test(parentHtml)) {
                        found = t;
                        break;
                    }
                }
            }
        }
        if (!found) {
            for (const el of leaves) {
                const t = textOf(el);
                if (/^\d\.\d$/.test(t)) {
                    found = t;
                    break;
                }
            }
        }
        result.rating = found;
    }

    // ---- reviews fallback ----
    if (!result.reviews) {
        const elements = Array.from(document.querySelectorAll("span, div"));
        for (const el of elements) {
            const t = textOf(el);
            if (!t || t.length > 120) continue;
            let m = t.match(/^([\d,]+)\s+Reviews?$/i);
            if (m) {
                result.reviews = m[1];
                break;
            }
            m = t.match(/Ratings?\s*(?:&|and)\s*([\d,]+)\s+Reviews?/i);
            if (m) {
                result.reviews = m[1];
                break;
            }
            m = t.match(/([\d,]+)\s+ratings?\s*[,•]\s*([\d,]+)\s+reviews?/i);
            if (m) {
                result.reviews = m[2];
                break;
            }
        }
    }

    // ---- seller ----
    if (!result.seller) {
        let sellerText = null;
        const seeOther = Array.from(document.querySelectorAll("*")).find(
            (el) => textOf(el).toLowerCase() === "see other sellers"
        );
        if (seeOther) {
            let p = seeOther;
            for (let i = 0; i < 3 && p; i++) {
                p = p.parentElement;
                if (p) {
                    const t = textOf(p);
                    if (t.length < 200 && /\d\.\d/.test(t)) {
                        sellerText = t;
                        break;
                    }
                }
            }
        }
        if (!sellerText) {
            const el = Array.from(document.querySelectorAll("*")).find((el) => /^Fulfilled by\s+/i.test(textOf(el)) && textOf(el).length < 120);
            if (el) sellerText = textOf(el);
        }
        if (!sellerText) {
            const el = document.querySelector('[data-testid*="seller" i], [aria-label*="seller" i], [id*="seller" i]');
            const t = textOf(el);
            if (t && t.length < 100) sellerText = t;
        }
        if (!sellerText) {
            const a = document.querySelector('a[href*="seller" i], a[href*="/str/" i], a[href*="storeid" i], a[href*="spotlight" i]');
            if (a) sellerText = textOf(a);
        }
        if (!sellerText) {
            sellerText = firstNonEmpty(["#sellerName span", "div._1RLviY", "span._1RLviY"]);
        }
        if (!sellerText) {
            const el = Array.from(document.querySelectorAll("*")).find((el) => textOf(el) === "Seller");
            if (el && el.nextElementSibling) sellerText = textOf(el.nextElementSibling);
        }
        if (!sellerText) {
            const el = Array.from(document.querySelectorAll("*")).find((el) => /^Sold by\s+/i.test(textOf(el)));
            if (el) sellerText = textOf(el);
        }
        result.seller = cleanSeller(sellerText);
    }

    // ---- inventory status ----
    if (!result.inventory_status) {
        const bodyText = document.body.innerText || "";
        if (/sold\s*out/i.test(bodyText) || /out of stock/i.test(bodyText)) {
            result.inventory_status = "Out of Stock";
        } else if (/add to cart|buy now/i.test(bodyText)) {
            result.inventory_status = "In Stock";
        } else if (/notify me/i.test(bodyText)) {
            result.inventory_status = "Out of Stock";
        }
    }

    // ---- image ----
    if (!result.image_url) {
        const og = document.querySelector('meta[property="og:image"]');
        if (og && og.content) {
            result.image_url = og.content;
        } else {
            const imgs = Array.from(document.querySelectorAll("img")).filter((img) => img.src && img.src.includes("rukminim"));
            let best = null;
            for (const img of imgs) {
                const m = img.src.match(/\/image\/(\d+)\/(\d+)\//);
                if (m && parseInt(m[1], 10) >= 400 && parseInt(m[2], 10) >= 400) {
                    best = img.src;
                    break;
                }
            }
            result.image_url = best || (imgs.length ? imgs[0].src : null);
        }
    }

    return result;
}
"""


class FlipkartSpider(scrapy.Spider):
    name = "flipkart"

    custom_settings = {"DOWNLOAD_DELAY": 1.5, "RANDOMIZE_DOWNLOAD_DELAY": True}

    def __init__(self, records=None, batch_id=None, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.records = records or []
        self.batch_id = batch_id

    async def start(self):
        for record in self.records:
            code = record.get("code")
            url = f"https://www.flipkart.com/product/p/itm?pid={code}"
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
        try:
            scraped = await self._extract(page)
        except Exception as exc:  # noqa: BLE001 — never let extraction errors escape to errback
            scraped = base_result(title="ERROR", scrap_status=str(exc))
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

    async def _extract(self, page):
        try:
            await page.locator("button._2KpZ6l._2doB4z").first.click(timeout=2000)
        except Exception:  # noqa: BLE001 — best-effort popup dismissal
            pass

        try:
            await page.wait_for_function("document.body.innerText.includes('₹')", timeout=6000)
        except Exception:  # noqa: BLE001 — best-effort wait, extraction proceeds regardless
            pass

        await page.wait_for_timeout(1200)

        body_text = await page.inner_text("body")
        lowered = body_text.lower()
        if "page not found" in lowered or ("sorry" in lowered and "₹" not in body_text):
            return base_result(title="ERROR", scrap_status="NOT FOUND")

        scraped = await page.evaluate(_EVAL_JS)
        scraped["product_url"] = page.url
        scraped["scrap_status"] = "SUCCESS" if (scraped.get("price") or scraped.get("title")) else "EMPTY"
        return scraped

    def errback(self, failure):
        record = failure.request.meta["record"]
        message = f"{self.name} {record.get('code')}: {failure.value}"
        self.logger.error(message)
        job_store.record_error(self.batch_id, message)
