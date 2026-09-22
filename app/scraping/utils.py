"""Shared helpers used by every spider and by the job pipeline.

These mirror the Node app's `parsePrice()` / `priceStatus()` exactly so price-status
classification behaves identically.
"""

import re

_PRICE_CLEAN_RE = re.compile(r"[^\d.]")


def parse_price(value) -> float | None:
    """Strips ₹ / commas / whitespace and parses a float, or None if not parseable."""
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    s = str(value).strip()
    if not s:
        return None
    s = s.replace("₹", "").replace(",", "").strip()
    s = _PRICE_CLEAN_RE.sub("", s)
    if not s or s == ".":
        return None
    try:
        return float(s)
    except ValueError:
        return None


def price_status(price: float | None, mop: float | None) -> str:
    if price is None or mop is None:
        return "UNKNOWN"
    if price < mop:
        return "BELOW_MOP"
    if price == mop:
        return "AT_MOP"
    return "ABOVE_MOP"


def clean_seller_text(text: str | None) -> str | None:
    """Strips 'Fulfilled by'/'Sold by' prefixes and cuts at a trailing rating-shaped substring."""
    if not text:
        return text
    s = text.strip()
    s = re.sub(r"^(Fulfilled by|Sold by)\s+", "", s, flags=re.IGNORECASE)
    m = re.search(r"\d\.\d", s)
    if m:
        s = s[: m.start()].strip()
    s = re.sub(r"\s*See other sellers.*$", "", s, flags=re.IGNORECASE)
    return s.strip() or None


EMPTY_RESULT = {
    "title": None,
    "price": None,
    "mrp": None,
    "rating": None,
    "reviews": None,
    "seller": None,
    "product_url": None,
    "image_url": None,
    "inventory_status": None,
    "scrap_status": "EMPTY",
}


def base_result(**overrides) -> dict:
    result = dict(EMPTY_RESULT)
    result.update(overrides)
    return result
