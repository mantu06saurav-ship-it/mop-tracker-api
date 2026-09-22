"""'MOP Breached Summary' penalty report — one row per (portal, seller) group of below-MOP
listings, with a ₹250 Vertical-Head penalty and ₹250 KAM penalty per breached article (a
breach requires the shortfall to exceed the ₹15 tolerance).
"""

import re

from app.core.constants import PENALTY_GAP_TOLERANCE, PENALTY_KAM_RATE, PENALTY_PORTAL_COLS, PENALTY_VH_RATE

_PORTAL_KEYS = [c["key"] for c in PENALTY_PORTAL_COLS]
_PORTAL_LABELS = {c["key"]: c["label"] for c in PENALTY_PORTAL_COLS}


def normalize_seller_key(seller: str | None) -> str:
    if not seller:
        return ""
    return re.sub(r"[^A-Za-z0-9]", "", seller).upper()


def compute_vertical_from_seller(seller: str | None) -> str:
    key = normalize_seller_key(seller)
    if "LIBERTYSHOESLTD" in key or "LIBERTYSHOESLIMITED" in key:
        return "MP"
    return "OR"


def match_penalty_portal_key(portal: str | None) -> str | None:
    if not portal:
        return None
    p = portal.lower()
    for key in _PORTAL_KEYS:
        if key in p:
            return key
    return None


def find_seller_mapping(mapping_rows: list[dict], seller: str | None, portal_key: str | None) -> dict | None:
    if portal_key is None:
        return None
    vertical = compute_vertical_from_seller(seller)
    if vertical == "MP":
        for m in mapping_rows:
            if (m.get("portal") or "").lower() == portal_key and (m.get("sub_type") or "").upper() == "MP":
                return m
        return None
    seller_key = normalize_seller_key(seller)
    for m in mapping_rows:
        if (m.get("portal") or "").lower() == portal_key and normalize_seller_key(m.get("seller")) == seller_key:
            return m
    return None


def build_penalty_report_rows(below_rows: list[dict], mapping_rows: list[dict]) -> list[dict]:
    groups: dict[tuple, dict] = {}

    for row in below_rows:
        portal_key = match_penalty_portal_key(row.get("portal"))
        seller = row.get("seller") or "Unknown Seller"
        group_key = (portal_key, seller)
        group = groups.setdefault(
            group_key,
            {
                "portal_key": portal_key,
                "seller": seller,
                "mop_sum": 0.0,
                "portal_sum": 0.0,
                "breach_articles": set(),
                "breach_row_count": 0,
            },
        )
        mop = row.get("mop") or 0
        price = row.get("price_scraped") or 0
        group["mop_sum"] += mop
        group["portal_sum"] += price

        shortfall = mop - price
        if shortfall > PENALTY_GAP_TOLERANCE:
            article = row.get("article")
            if article:
                group["breach_articles"].add(article)
            else:
                group["breach_row_count"] += 1

    rows = []
    for (portal_key, seller), group in groups.items():
        mapping = find_seller_mapping(mapping_rows, seller, portal_key)
        mop_value = round(group["mop_sum"])
        portal_value = round(group["portal_sum"])
        variance = portal_value - mop_value
        variance_pct = round((variance / mop_value) * 100) if mop_value else 0
        breached_count = len(group["breach_articles"]) if group["breach_articles"] else group["breach_row_count"]
        penalty_amount = breached_count * (PENALTY_VH_RATE + PENALTY_KAM_RATE)

        rows.append(
            {
                "portalLabel": _PORTAL_LABELS.get(portal_key, (portal_key or "Unknown").title()),
                "verticalHead": mapping.get("vertical_head") if mapping else "Unmapped",
                "kam": mapping.get("kam") if mapping else "—",
                "seller": seller,
                "mopValue": mop_value,
                "portalValue": portal_value,
                "variance": variance,
                "variancePct": variance_pct,
                "breachedCount": breached_count,
                "penaltyRate": PENALTY_VH_RATE + PENALTY_KAM_RATE,
                "penaltyAmount": penalty_amount,
                "vhPenaltyAmount": breached_count * PENALTY_VH_RATE,
                "kamPenaltyAmount": breached_count * PENALTY_KAM_RATE,
            }
        )

    rows.sort(key=lambda r: (r["verticalHead"] or "", r["kam"] or "", r["seller"] or ""))
    return rows
