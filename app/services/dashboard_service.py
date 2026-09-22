from sqlalchemy import text

from app.db.session import get_conn

_LATEST_REPORT_SQL = text(
    """
    SELECT * FROM (
        SELECT *, ROW_NUMBER() OVER (PARTITION BY code ORDER BY scraped_at DESC) AS rn
        FROM dbo.mop_tracker
    ) t WHERE rn = 1
    ORDER BY scraped_at DESC
    """
)


def _row_to_dict(row) -> dict:
    d = dict(row._mapping)
    d.pop("rn", None)
    return d


def get_latest_report_rows() -> list[dict]:
    """Latest scrape ever, per code — NOT scoped to a single batch."""
    with get_conn() as conn:
        rows = conn.execute(_LATEST_REPORT_SQL).fetchall()
    return [_row_to_dict(r) for r in rows]


def build_summary(rows: list[dict]) -> dict:
    total = len(rows)
    below = sum(1 for r in rows if r.get("price_status") == "BELOW_MOP")
    at_mop = sum(1 for r in rows if r.get("price_status") == "AT_MOP")
    above = sum(1 for r in rows if r.get("price_status") == "ABOVE_MOP")
    unknown = total - below - at_mop - above
    compliance_pct = round(((at_mop + above) / total) * 1000) / 10 if total else 0
    return {
        "total": total,
        "below_mop": below,
        "at_mop": at_mop,
        "above_mop": above,
        "unknown": unknown,
        "compliance_pct": compliance_pct,
    }


def get_dashboard() -> dict:
    try:
        rows = get_latest_report_rows()
        return {"summary": build_summary(rows), "rows": rows}
    except Exception:
        return {
            "summary": {"total": 0, "below_mop": 0, "at_mop": 0, "above_mop": 0, "unknown": 0, "compliance_pct": 0},
            "rows": [],
        }


def get_batches() -> list[dict]:
    sql = text(
        """
        SELECT batch_id, COUNT(*) AS total,
               SUM(CASE WHEN price_status='BELOW_MOP' THEN 1 ELSE 0 END) AS below_mop,
               MIN(scraped_at) AS scraped_at
        FROM dbo.mop_tracker GROUP BY batch_id ORDER BY MIN(scraped_at) DESC
        """
    )
    try:
        with get_conn() as conn:
            rows = conn.execute(sql).fetchall()
        return [dict(r._mapping) for r in rows]
    except Exception:
        return []


def get_trends() -> list[dict]:
    sql = text(
        """
        SELECT batch_id, COUNT(*) AS total,
               SUM(CASE WHEN price_status='BELOW_MOP' THEN 1 ELSE 0 END) AS below_mop,
               SUM(CASE WHEN price_status='AT_MOP' THEN 1 ELSE 0 END) AS at_mop,
               SUM(CASE WHEN price_status='ABOVE_MOP' THEN 1 ELSE 0 END) AS above_mop,
               SUM(CASE WHEN price_status IS NULL OR price_status='UNKNOWN' THEN 1 ELSE 0 END) AS unknown,
               MIN(scraped_at) AS scraped_at
        FROM dbo.mop_tracker GROUP BY batch_id ORDER BY MIN(scraped_at) ASC
        """
    )
    try:
        with get_conn() as conn:
            rows = [dict(r._mapping) for r in conn.execute(sql).fetchall()]
        for r in rows:
            total = r["total"] or 1
            r["compliance_pct"] = round(((r["at_mop"] + r["above_mop"]) / total) * 1000) / 10
        return rows[-20:]
    except Exception:
        return []


def get_portal_breakdown() -> list[dict]:
    try:
        rows = get_latest_report_rows()
    except Exception:
        return []
    buckets: dict[str, dict] = {}
    for r in rows:
        portal = r.get("portal") or "Unknown"
        b = buckets.setdefault(
            portal, {"portal": portal, "total": 0, "below_mop": 0, "at_mop": 0, "above_mop": 0, "unknown": 0}
        )
        b["total"] += 1
        status = r.get("price_status")
        if status == "BELOW_MOP":
            b["below_mop"] += 1
        elif status == "AT_MOP":
            b["at_mop"] += 1
        elif status == "ABOVE_MOP":
            b["above_mop"] += 1
        else:
            b["unknown"] += 1
    return list(buckets.values())


def get_compliance_daily(days: int) -> dict:
    days = max(1, min(90, days))
    sql = text(
        """
        SELECT * FROM (
            SELECT *, CAST(scraped_at AS DATE) AS snapshot_date_raw,
                   ROW_NUMBER() OVER (
                       PARTITION BY code, CAST(scraped_at AS DATE)
                       ORDER BY scraped_at DESC
                   ) AS rn
            FROM dbo.mop_tracker
            WHERE scraped_at >= DATEADD(DAY, -:days, CAST(GETDATE() AS DATE))
        ) t WHERE rn = 1
        ORDER BY snapshot_date_raw ASC
        """
    )
    try:
        with get_conn() as conn:
            rows = conn.execute(sql, {"days": days}).fetchall()
        result = []
        for r in rows:
            d = dict(r._mapping)
            d.pop("rn", None)
            sd = d.pop("snapshot_date_raw", None)
            d["snapshot_date"] = sd.isoformat() if sd else None
            result.append(d)
        return {"rows": result, "days": days}
    except Exception:
        return {"rows": [], "days": days}
