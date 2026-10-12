"""Assembles and sends the daily combined MOP + Audit snapshot email — the
"MOP Breached Summary daily report with seller-mapping table" feature.
"""

from sqlalchemy import text

from app.db.session import get_conn
from app.services.audit_service import (
    build_audit_blocks,
    build_audit_field_summary,
    build_audit_portal_summary,
    build_audit_report_rows,
    build_audit_top_skus,
    summarize_audit_blocks,
)
from app.services.dashboard_service import build_summary, get_latest_report_rows
from app.services.email_service import build_daily_snapshot_html, save_email_delivery, send_email
from app.services.excel_service import build_xlsx, file_stamp
from app.services.penalty_service import build_penalty_report_rows, find_seller_mapping, match_penalty_portal_key


def get_zfg_article_map() -> dict[str, str]:
    with get_conn() as conn:
        rows = conn.execute(text("SELECT sku, artical FROM dbo.latest_zfg")).fetchall()
    return {r.sku: r.artical for r in rows if r.sku}


def get_seller_mapping_rows() -> list[dict]:
    with get_conn() as conn:
        rows = conn.execute(text("SELECT * FROM dbo.seller_mapping")).fetchall()
    return [dict(r._mapping) for r in rows]


def filter_rows_by_email_active(rows: list[dict], mapping_rows: list[dict]) -> list[dict]:
    """Drops rows whose matched seller_mapping has email_active=false; unmapped sellers stay
    included (never silently dropped for lack of a mapping)."""
    result = []
    for r in rows:
        portal_key = match_penalty_portal_key(r.get("portal"))
        mapping = find_seller_mapping(mapping_rows, r.get("seller"), portal_key)
        if mapping is not None and mapping.get("email_active") in (0, False):
            continue
        result.append(r)
    return result


def deliver_daily_snapshot_email(to_emails: list[str], cc_emails: list[str]) -> dict:
    all_rows = get_latest_report_rows()
    audit_blocks = build_audit_blocks()
    article_map = get_zfg_article_map()
    mapping_rows = get_seller_mapping_rows()

    filtered_rows = filter_rows_by_email_active(all_rows, mapping_rows)
    below_rows = [dict(r) for r in filtered_rows if r.get("price_status") == "BELOW_MOP"]
    for r in below_rows:
        sku = str(r.get("sku") or "").strip()
        r["article"] = article_map.get(sku.zfill(15)) if sku else None

    mop_summary = build_summary(all_rows)
    audit_summary = summarize_audit_blocks(audit_blocks)
    penalty_rows = build_penalty_report_rows(below_rows, mapping_rows)
    portal_summary_rows = build_audit_portal_summary(audit_blocks)
    field_summary_rows = build_audit_field_summary(audit_blocks)
    top_sku_rows = build_audit_top_skus(audit_blocks)

    html = build_daily_snapshot_html(
        mop_summary, below_rows, penalty_rows, audit_summary, portal_summary_rows, field_summary_rows, top_sku_rows
    )

    audit_report_rows = build_audit_report_rows(audit_blocks)
    xlsx_bytes = build_xlsx(
        {
            "Below MOP": below_rows or [{}],
            "Audit Report": audit_report_rows or [{}],
            "Penalty Report": penalty_rows or [{}],
        }
    )

    subject = f"MOP Tracker — Daily Snapshot ({len(below_rows)} Below MOP, {audit_summary['notOkFields']} Audit Mismatches)"
    receipt = send_email(
        to_emails,
        subject,
        html,
        cc_emails=cc_emails,
        attachments=[(f"mop_audit_snapshot_{file_stamp()}.xlsx", xlsx_bytes)],
    )
    save_email_delivery(receipt)
    return receipt


def email_schedule_status(settings_row: dict, today_str: str, busy: bool) -> str:
    if busy:
        return "A snapshot email is currently being sent."
    if settings_row.get("mode") != "auto":
        return "Manual mode — use 'Send Now' to deliver a snapshot."
    if not settings_row.get("enabled"):
        return "Automatic sending is disabled."
    if not (settings_row.get("to_emails") or "").strip():
        return "No recipients configured."
    if settings_row.get("last_sent_date") == today_str:
        return f"Already sent today at {settings_row.get('last_sent_at')}."
    return f"Pending — scheduled to send at {settings_row.get('send_time')}."
