"""Cross-checks each MOP-tracked listing's scraped data against SAP ZFG master data:
title-format compliance, MRP match, rating/review presence, in-stock frontend sync.
"""

import re
from datetime import datetime, timezone

from sqlalchemy import text

from app.db.session import get_conn
from app.services.dashboard_service import get_latest_report_rows


def base_sku_from_zfg(sku: str | None) -> str | None:
    """latest_zfg.sku is zero-padded to 15 chars in the source export; mop_data.sku_code is
    the bare 10-digit code — join on the last 10 characters."""
    if not sku:
        return None
    return str(sku)[-10:]


def _dept_matches_title(deptt: str | None, title_lower: str) -> bool:
    if not deptt:
        return True
    deptt_lower = str(deptt).lower()
    if deptt_lower in title_lower:
        return True
    return deptt_lower == "kids" and ("boys" in title_lower or "girls" in title_lower)


def build_target_title(zfg: dict | None) -> str:
    if not zfg:
        return "No ZFG data"
    parts = ["Liberty", zfg.get("brand"), zfg.get("artical"), zfg.get("color_ptn"), zfg.get("class"), zfg.get("deptt")]
    return " ".join(str(p) for p in parts if p)


def title_match_check(zfg: dict | None, actual_title: str | None) -> tuple[str, str]:
    """Required components: Liberty (literal), Brand, Article, Color/PTN, Class, Deptt.
    Sub-Class and Shoes Type are deliberately excluded from the formula."""
    if not zfg or not actual_title:
        return "NOT_OK", "Missing ZFG or scraped title data"

    title_lower = actual_title.lower()
    missing: list[str] = []
    if "liberty" not in title_lower:
        missing.append("Liberty")
    for label, value in {
        "Brand": zfg.get("brand"),
        "Article": zfg.get("artical"),
        "Color/PTN": zfg.get("color_ptn"),
        "Class": zfg.get("class"),
    }.items():
        if value and str(value).lower() not in title_lower:
            missing.append(label)
    if not _dept_matches_title(zfg.get("deptt"), title_lower):
        missing.append("Deptt")

    if missing:
        return "NOT_OK", f"Missing/mismatched: {', '.join(missing)}"
    return "OK", "All components matched"


def mrp_remark(target_mrp, actual_mrp) -> tuple[str, str]:
    if target_mrp is None or actual_mrp is None:
        return "NOT_OK", "Missing MRP data"
    if round(target_mrp) == round(actual_mrp):
        return "OK", "Matches"
    return "NOT_OK", f"Target {target_mrp} vs Actual {actual_mrp}"


def sync_remark(tracker: dict | None) -> tuple[str, str]:
    status = tracker.get("inventory_status") if tracker else None
    if status and re.search(r"in stock", status, re.IGNORECASE):
        return "OK", "In sync"
    return "NOT_OK", "Not in sync / no scrape"


def make_audit_block(sku: str, zfg: dict | None, listing: dict, tracker: dict | None) -> dict:
    actual_title = tracker.get("title") if tracker else None
    title_remark, title_note = title_match_check(zfg, actual_title)

    target_mrp = zfg.get("mrp") if zfg else None
    actual_mrp = tracker.get("mrp") if tracker else None
    mrp_remark_val, mrp_note = mrp_remark(target_mrp, actual_mrp)
    actual_mrp_display = actual_mrp
    if tracker and tracker.get("scraped_at") and actual_mrp is not None:
        scraped_at = tracker["scraped_at"]
        if isinstance(scraped_at, datetime):
            days = (datetime.now(scraped_at.tzinfo or None) - scraped_at).days
            actual_mrp_display = f"{actual_mrp} (Days Since Last MRP Update: {days} days ago)"

    sync_remark_val, sync_note = sync_remark(tracker)

    rows = [
        {"field": "Title", "target": build_target_title(zfg), "actual": actual_title, "remark": title_remark, "note": title_note},
        {"field": "MRP", "target": target_mrp, "actual": actual_mrp_display, "remark": mrp_remark_val, "note": mrp_note},
        {"field": "Rating", "target": "--", "actual": (tracker.get("rating") if tracker else "--"), "remark": ("OK" if tracker else "--"), "note": ""},
        {"field": "Review", "target": "--", "actual": (tracker.get("reviews") if tracker else "--"), "remark": ("OK" if tracker else "--"), "note": ""},
        {"field": "Frontend Sync", "target": "In Stock", "actual": (tracker.get("inventory_status") if tracker else "--"), "remark": sync_remark_val, "note": sync_note},
    ]

    return {
        "sku": sku,
        "artical": zfg.get("artical") if zfg else None,
        "brand": listing.get("brand"),
        "portal": listing.get("portal"),
        "code": listing.get("code"),
        "code_type": listing.get("code_type"),
        "dist_mat": zfg.get("dist_mat") if zfg else None,
        "sap_indicator": zfg.get("sap_indicator") if zfg else None,
        "size_level": zfg.get("size_level") if zfg else None,
        "has_zfg": zfg is not None,
        "has_scrape": tracker is not None,
        "rows": rows,
    }


def build_audit_blocks() -> list[dict]:
    with get_conn() as conn:
        mop_data_rows = [dict(r._mapping) for r in conn.execute(text("SELECT * FROM dbo.mop_data")).fetchall()]
        zfg_rows = [dict(r._mapping) for r in conn.execute(text("SELECT * FROM dbo.latest_zfg")).fetchall()]
    tracker_rows = get_latest_report_rows()

    zfg_by_sku: dict[str, dict] = {}
    for z in zfg_rows:
        key = base_sku_from_zfg(z.get("sku"))
        if key:
            zfg_by_sku[key] = z

    tracker_by_code = {t.get("code"): t for t in tracker_rows}

    mop_by_sku: dict[str, list[dict]] = {}
    for m in mop_data_rows:
        mop_by_sku.setdefault(m.get("sku_code"), []).append(m)

    blocks = []
    for sku, listings in mop_by_sku.items():
        zfg = zfg_by_sku.get(sku)
        for listing in listings:
            tracker = tracker_by_code.get(listing.get("code"))
            blocks.append(make_audit_block(sku, zfg, listing, tracker))
    return blocks


def summarize_audit_blocks(blocks: list[dict]) -> dict:
    total_blocks = len(blocks)
    not_ok_fields = sum(1 for b in blocks for r in b["rows"] if r["remark"] == "NOT_OK")
    missing_zfg = sum(1 for b in blocks if not b["has_zfg"])

    ok_by_sku: dict[str, bool] = {}
    for b in blocks:
        sku = b["sku"]
        has_not_ok = any(r["remark"] == "NOT_OK" for r in b["rows"])
        ok_by_sku[sku] = ok_by_sku.get(sku, True) and not has_not_ok
    full_ok_skus = sum(1 for ok in ok_by_sku.values() if ok)

    return {"totalBlocks": total_blocks, "notOkFields": not_ok_fields, "fullOkSkus": full_ok_skus, "missingZfg": missing_zfg}


def build_audit_portal_summary(blocks: list[dict]) -> list[dict]:
    buckets: dict[str, dict] = {}
    for b in blocks:
        portal = b.get("portal") or "Unknown"
        bucket = buckets.setdefault(portal, {"portal": portal, "audited": 0, "fails": 0})
        bucket["audited"] += 1
        if any(r["remark"] == "NOT_OK" for r in b["rows"]):
            bucket["fails"] += 1
    result = []
    for bucket in buckets.values():
        bucket["pass"] = bucket["audited"] - bucket["fails"]
        bucket["passPct"] = round((bucket["pass"] / bucket["audited"]) * 100) if bucket["audited"] else 0
        result.append(bucket)
    result.sort(key=lambda x: x["audited"], reverse=True)
    return result


def build_audit_field_summary(blocks: list[dict]) -> list[dict]:
    total_blocks = len(blocks) or 1
    counts: dict[str, int] = {}
    for b in blocks:
        for r in b["rows"]:
            if r["remark"] == "NOT_OK":
                counts[r["field"]] = counts.get(r["field"], 0) + 1
    result = [{"field": f, "fails": c, "pct": round((c / total_blocks) * 100)} for f, c in counts.items()]
    result.sort(key=lambda x: x["fails"], reverse=True)
    return result


def build_audit_top_skus(blocks: list[dict], limit: int = 10) -> list[dict]:
    by_sku: dict[str, dict] = {}
    for b in blocks:
        fails = sum(1 for r in b["rows"] if r["remark"] == "NOT_OK")
        if fails <= 0:
            continue
        entry = by_sku.setdefault(b["sku"], {"sku": b["sku"], "artical": b.get("artical"), "fails": 0, "portals": set()})
        entry["fails"] += fails
        if b.get("portal"):
            entry["portals"].add(b["portal"])
    result = [
        {"sku": e["sku"], "artical": e["artical"], "fails": e["fails"], "portals": ", ".join(sorted(e["portals"]))}
        for e in by_sku.values()
    ]
    result.sort(key=lambda x: x["fails"], reverse=True)
    return result[:limit]


def build_audit_report_rows(blocks: list[dict]) -> list[dict]:
    rows = []
    for b in blocks:
        for r in b["rows"]:
            rows.append(
                {
                    "SKU": b["sku"],
                    "Article": b.get("artical"),
                    "Brand": b.get("brand"),
                    "Portal": b.get("portal"),
                    "Code Type": b.get("code_type"),
                    "Code": b.get("code"),
                    "Dist_Mat": b.get("dist_mat"),
                    "SAP Indicator": b.get("sap_indicator"),
                    "Size Level": b.get("size_level"),
                    "Field": r["field"],
                    "Target": r["target"],
                    "Actual": r["actual"],
                    "Remark": r["remark"],
                    "Note": r["note"],
                }
            )
    return rows
