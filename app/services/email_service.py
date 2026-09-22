"""SMTP sending + HTML report builders. All amounts are formatted with Indian digit grouping
(₹1,23,456) via `fmt_inr`, matching the Node app's `toLocaleString("en-IN")`.
"""

import json
import logging
import smtplib
from datetime import datetime
from email.mime.application import MIMEApplication
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formataddr

from sqlalchemy import text

from app.core.config import get_settings
from app.db.session import get_conn

logger = logging.getLogger("mop_tracker.email")


def esc(v) -> str:
    if v is None:
        return ""
    return str(v).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def indian_number_format(n) -> str:
    n = round(n or 0)
    neg = n < 0
    n = abs(n)
    s = str(n)
    if len(s) <= 3:
        return ("-" if neg else "") + s
    last3, rest = s[-3:], s[:-3]
    parts = []
    while len(rest) > 2:
        parts.insert(0, rest[-2:])
        rest = rest[:-2]
    if rest:
        parts.insert(0, rest)
    return ("-" if neg else "") + ",".join(parts) + "," + last3


def fmt_inr(n) -> str:
    return f"₹{indian_number_format(n)}"


def send_email(
    to_emails: list[str],
    subject: str,
    html: str,
    cc_emails: list[str] | None = None,
    attachments: list[tuple[str, bytes]] | None = None,
) -> dict:
    """Returns a delivery receipt dict: {status, accepted, rejected, attemptedAt} (or
    {status:"failed", error, attemptedAt} on total failure) — mirrors email-delivery.js."""
    settings = get_settings()
    attempted_at = datetime.now().isoformat()

    msg = MIMEMultipart()
    msg["Subject"] = subject
    msg["From"] = formataddr((settings.smtp_from_name, settings.smtp_user))
    msg["To"] = ", ".join(to_emails)
    if cc_emails:
        msg["Cc"] = ", ".join(cc_emails)
    msg.attach(MIMEText(html, "html"))

    for filename, content in attachments or []:
        part = MIMEApplication(content, Name=filename)
        part["Content-Disposition"] = f'attachment; filename="{filename}"'
        msg.attach(part)

    all_recipients = list(to_emails) + list(cc_emails or [])

    try:
        if settings.smtp_port == 465:
            server = smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, timeout=120)
        else:
            server = smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=120)
            server.starttls()
        with server:
            server.login(settings.smtp_user, settings.smtp_password)
            refused = server.sendmail(settings.smtp_user, all_recipients, msg.as_string())
        rejected = list(refused.keys())
        accepted = [r for r in all_recipients if r not in rejected]
        if not accepted:
            raise RuntimeError("SMTP rejected all recipients")
        return {
            "status": "partial" if rejected else "accepted",
            "accepted": accepted,
            "rejected": rejected,
            "attemptedAt": attempted_at,
        }
    except Exception as exc:  # noqa: BLE001
        logger.error("Email send failed: %s", exc)
        return {"status": "failed", "error": str(exc), "attemptedAt": attempted_at}


def save_email_delivery(receipt: dict) -> None:
    with get_conn() as conn:
        conn.execute(
            text("UPDATE dbo.email_settings SET last_delivery = :receipt WHERE id = 1"),
            {"receipt": json.dumps(receipt)},
        )


# ---------------------------------------------------------------------------
# Below-MOP ad-hoc report (POST /send-below-mop-report)
# ---------------------------------------------------------------------------

def build_below_mop_html(rows: list[dict]) -> str:
    body_rows = "".join(
        "<tr>"
        f"<td style='padding:6px;border:1px solid #ddd;'>{esc(r.get('portal'))}</td>"
        f"<td style='padding:6px;border:1px solid #ddd;'>{esc(r.get('code'))}</td>"
        f"<td style='padding:6px;border:1px solid #ddd;'>{esc(r.get('sku'))}</td>"
        f"<td style='padding:6px;border:1px solid #ddd;'>{esc(r.get('mop'))}</td>"
        f"<td style='padding:6px;border:1px solid #ddd;'>{esc(r.get('price_scraped'))}</td>"
        f"<td style='padding:6px;border:1px solid #ddd;'>{esc(r.get('title'))}</td>"
        f"<td style='padding:6px;border:1px solid #ddd;'>{esc(r.get('seller'))}</td>"
        f"<td style='padding:6px;border:1px solid #ddd;'><a href='{esc(r.get('product_url'))}'>{esc(r.get('product_url'))}</a></td>"
        "</tr>"
        for r in rows
    )
    generated = datetime.now().strftime("%d %b %Y, %I:%M %p")
    headers = "".join(
        f"<th style='padding:6px;border:1px solid #ddd;background:#1d4ed8;color:#fff;'>{h}</th>"
        for h in ["Portal", "Code", "SKU", "MOP", "Scraped Price", "Title", "Seller", "Product URL"]
    )
    return (
        "<div style='font-family:Arial,sans-serif;font-size:13px;color:#1f2937;'>"
        "<h2 style='color:#1d4ed8;'>MOP Tracker — Below MOP Report</h2>"
        f"<table style='border-collapse:collapse;width:100%;'><thead><tr>{headers}</tr></thead>"
        f"<tbody>{body_rows}</tbody></table>"
        f"<p style='color:#6b7280;margin-top:12px;'>Generated at {generated}</p>"
        "</div>"
    )


# ---------------------------------------------------------------------------
# Daily combined snapshot — "MOP Breached Summary daily report with seller-mapping table"
# ---------------------------------------------------------------------------

def _stat_card(label: str, value, color: str) -> str:
    return (
        f"<td style='padding:12px;border-top:3px solid {color};background:#f9fafb;text-align:center;'>"
        f"<div style='font-size:20px;font-weight:bold;color:#111827;'>{esc(value)}</div>"
        f"<div style='font-size:11px;color:#6b7280;margin-top:4px;'>{esc(label)}</div></td>"
    )


def build_penalty_table_html(rows: list[dict]) -> str:
    if not rows:
        return "<p style='color:#16a34a;font-weight:bold;'>🎉 No penalty-eligible below-MOP breaches today.</p>"

    header_cols = [
        "Portal", "Vertical Head", "KAM", "Seller", "MOP Value", "Portal Value", "Var.", "Var%",
        "Breached", "Penalty Rate", "Penalty Amt", "VH Penalty", "KAM Penalty",
    ]
    headers = "".join(f"<th style='padding:6px;border:1px solid #ddd;background:#0f172a;color:#fff;'>{h}</th>" for h in header_cols)

    body_rows = []
    totals = {"mopValue": 0, "portalValue": 0, "variance": 0, "breachedCount": 0, "penaltyAmount": 0, "vhPenaltyAmount": 0, "kamPenaltyAmount": 0}
    for r in rows:
        for k in totals:
            totals[k] += r.get(k) or 0
        body_rows.append(
            "<tr>"
            f"<td style='padding:6px;border:1px solid #ddd;'>{esc(r['portalLabel'])}</td>"
            f"<td style='padding:6px;border:1px solid #ddd;'>{esc(r['verticalHead'])}</td>"
            f"<td style='padding:6px;border:1px solid #ddd;'>{esc(r['kam'])}</td>"
            f"<td style='padding:6px;border:1px solid #ddd;'>{esc(r['seller'])}</td>"
            f"<td style='padding:6px;border:1px solid #ddd;'>{fmt_inr(r['mopValue'])}</td>"
            f"<td style='padding:6px;border:1px solid #ddd;'>{fmt_inr(r['portalValue'])}</td>"
            f"<td style='padding:6px;border:1px solid #ddd;'>{fmt_inr(r['variance'])}</td>"
            f"<td style='padding:6px;border:1px solid #ddd;'>{r['variancePct']}%</td>"
            f"<td style='padding:6px;border:1px solid #ddd;'>{r['breachedCount']}</td>"
            f"<td style='padding:6px;border:1px solid #ddd;'>{fmt_inr(r['penaltyRate'])}</td>"
            f"<td style='padding:6px;border:1px solid #ddd;'>{fmt_inr(r['penaltyAmount'])}</td>"
            f"<td style='padding:6px;border:1px solid #ddd;'>{fmt_inr(r['vhPenaltyAmount'])}</td>"
            f"<td style='padding:6px;border:1px solid #ddd;'>{fmt_inr(r['kamPenaltyAmount'])}</td>"
            "</tr>"
        )

    grand_total_row = (
        "<tr style='font-weight:bold;background:#f3f4f6;'>"
        "<td colspan='4' style='padding:6px;border:1px solid #ddd;'>Grand Total</td>"
        f"<td style='padding:6px;border:1px solid #ddd;'>{fmt_inr(totals['mopValue'])}</td>"
        f"<td style='padding:6px;border:1px solid #ddd;'>{fmt_inr(totals['portalValue'])}</td>"
        f"<td style='padding:6px;border:1px solid #ddd;'>{fmt_inr(totals['variance'])}</td>"
        "<td style='padding:6px;border:1px solid #ddd;'>—</td>"
        f"<td style='padding:6px;border:1px solid #ddd;'>{totals['breachedCount']}</td>"
        "<td style='padding:6px;border:1px solid #ddd;'>—</td>"
        f"<td style='padding:6px;border:1px solid #ddd;'>{fmt_inr(totals['penaltyAmount'])}</td>"
        f"<td style='padding:6px;border:1px solid #ddd;'>{fmt_inr(totals['vhPenaltyAmount'])}</td>"
        f"<td style='padding:6px;border:1px solid #ddd;'>{fmt_inr(totals['kamPenaltyAmount'])}</td>"
        "</tr>"
    )

    return (
        "<table style='border-collapse:collapse;width:100%;font-size:12px;'>"
        f"<thead><tr>{headers}</tr></thead><tbody>{''.join(body_rows)}{grand_total_row}</tbody></table>"
    )


def build_daily_snapshot_html(
    mop_summary: dict,
    below_rows: list[dict],
    penalty_rows: list[dict],
    audit_summary: dict,
    portal_summary_rows: list[dict],
    field_summary_rows: list[dict],
    top_sku_rows: list[dict],
) -> str:
    generated = datetime.now().strftime("%A, %d %B %Y")

    preview_rows = below_rows[:15]
    if preview_rows:
        preview_body = "".join(
            "<tr>"
            f"<td style='padding:6px;border:1px solid #ddd;'>{esc(r.get('portal'))}</td>"
            f"<td style='padding:6px;border:1px solid #ddd;'>{esc(r.get('code'))}</td>"
            f"<td style='padding:6px;border:1px solid #ddd;'>{esc(r.get('sku'))}</td>"
            f"<td style='padding:6px;border:1px solid #ddd;'>{esc(r.get('article'))}</td>"
            f"<td style='padding:6px;border:1px solid #ddd;'>{fmt_inr(r.get('mop'))}</td>"
            f"<td style='padding:6px;border:1px solid #ddd;'>{fmt_inr(r.get('price_scraped'))}</td>"
            f"<td style='padding:6px;border:1px solid #ddd;'>{esc(r.get('seller'))}</td>"
            "</tr>"
            for r in preview_rows
        )
        more_note = ""
        if len(below_rows) > 15:
            more_note = f"<p style='color:#6b7280;'>+{len(below_rows) - 15} more — see attached Excel.</p>"
        below_section = (
            "<table style='border-collapse:collapse;width:100%;font-size:12px;'>"
            "<thead><tr>"
            + "".join(
                f"<th style='padding:6px;border:1px solid #ddd;background:#1d4ed8;color:#fff;'>{h}</th>"
                for h in ["Portal", "Code", "SKU", "Article", "MOP", "Scraped Price", "Seller"]
            )
            + f"</tr></thead><tbody>{preview_body}</tbody></table>{more_note}"
        )
    else:
        below_section = "<p style='color:#16a34a;font-weight:bold;'>🎉 No SKUs are currently priced below MOP.</p>"

    portal_summary_body = "".join(
        "<tr>"
        f"<td style='padding:6px;border:1px solid #ddd;'>{esc(r['portal'])}</td>"
        f"<td style='padding:6px;border:1px solid #ddd;'>{r['audited']}</td>"
        f"<td style='padding:6px;border:1px solid #ddd;'>{r['fails']}</td>"
        f"<td style='padding:6px;border:1px solid #ddd;'>{r['pass']}</td>"
        f"<td style='padding:6px;border:1px solid #ddd;'>{r['passPct']}%</td>"
        "</tr>"
        for r in portal_summary_rows
    )

    field_summary_body = "".join(
        "<tr>"
        f"<td style='padding:6px;border:1px solid #ddd;'>{esc(r['field'])}</td>"
        f"<td style='padding:6px;border:1px solid #ddd;'>{r['fails']}</td>"
        f"<td style='padding:6px;border:1px solid #ddd;'>{r['pct']}%</td>"
        "</tr>"
        for r in field_summary_rows
    )

    top_sku_body = "".join(
        "<tr>"
        f"<td style='padding:6px;border:1px solid #ddd;'>{esc(r['sku'])}</td>"
        f"<td style='padding:6px;border:1px solid #ddd;'>{esc(r['artical'])}</td>"
        f"<td style='padding:6px;border:1px solid #ddd;'>{r['fails']}</td>"
        "</tr>"
        for r in top_sku_rows
    )

    return f"""
    <div style="font-family:Arial,sans-serif;color:#1f2937;max-width:900px;">
      <div style="background:linear-gradient(90deg,#1d4ed8,#0d9488);color:#fff;padding:24px;border-radius:8px 8px 0 0;">
        <div style="font-size:14px;opacity:0.9;">Liberty Shoes · MOP Tracker &amp; Listing Audit</div>
        <div style="font-size:22px;font-weight:bold;margin-top:4px;">Daily MOP &amp; Audit Snapshot</div>
        <div style="font-size:13px;margin-top:6px;opacity:0.85;">{generated}</div>
      </div>

      <h3 style="color:#1d4ed8;margin-top:20px;">MOP Compliance — Today's Snapshot</h3>
      <table style="width:100%;border-collapse:collapse;"><tr>
        {_stat_card("Total SKUs", mop_summary["total"], "#1d4ed8")}
        {_stat_card("Below MOP", mop_summary["below_mop"], "#dc2626")}
        {_stat_card("At MOP", mop_summary["at_mop"], "#d97706")}
        {_stat_card("Above MOP", mop_summary["above_mop"], "#16a34a")}
        {_stat_card("Compliance %", f"{mop_summary['compliance_pct']}%", "#1d4ed8")}
      </tr></table>

      <h3 style="color:#1d4ed8;margin-top:20px;">Below-MOP Sellers (preview)</h3>
      {below_section}

      <h3 style="color:#1d4ed8;margin-top:20px;">MOP Breached Summary — Daily Report</h3>
      <p style="font-size:12px;color:#6b7280;">
        Penalty of ₹250 (Vertical Head) + ₹250 (KAM) is applied per breached article where the
        shortfall vs MOP exceeds the ₹15 tolerance.
      </p>
      {build_penalty_table_html(penalty_rows)}

      <h3 style="color:#1d4ed8;margin-top:20px;">Audit Report — Today's Snapshot</h3>
      <table style="width:100%;border-collapse:collapse;"><tr>
        {_stat_card("Total Blocks", audit_summary["totalBlocks"], "#1d4ed8")}
        {_stat_card("Not OK Fields", audit_summary["notOkFields"], "#dc2626")}
        {_stat_card("SKUs Fully OK", audit_summary["fullOkSkus"], "#16a34a")}
        {_stat_card("Missing ZFG", audit_summary["missingZfg"], "#d97706")}
      </tr></table>

      <h4 style="margin-top:16px;">Portal Wise Summary</h4>
      <table style="border-collapse:collapse;width:100%;font-size:12px;">
        <thead><tr>{"".join(f"<th style='padding:6px;border:1px solid #ddd;background:#0f172a;color:#fff;'>{h}</th>" for h in ["Portal","Audited","Fails","Pass","Pass %"])}</tr></thead>
        <tbody>{portal_summary_body}</tbody>
      </table>

      <table style="width:100%;margin-top:16px;"><tr>
        <td style="vertical-align:top;width:50%;padding-right:8px;">
          <h4>Field Wise Failure Breakdown</h4>
          <table style="border-collapse:collapse;width:100%;font-size:12px;">
            <thead><tr>{"".join(f"<th style='padding:6px;border:1px solid #ddd;background:#0f172a;color:#fff;'>{h}</th>" for h in ["Field","Fails","Fail %"])}</tr></thead>
            <tbody>{field_summary_body}</tbody>
          </table>
        </td>
        <td style="vertical-align:top;width:50%;padding-left:8px;">
          <h4>Top Problem SKUs</h4>
          <table style="border-collapse:collapse;width:100%;font-size:12px;">
            <thead><tr>{"".join(f"<th style='padding:6px;border:1px solid #ddd;background:#0f172a;color:#fff;'>{h}</th>" for h in ["SKU","Article","Fails"])}</tr></thead>
            <tbody>{top_sku_body}</tbody>
          </table>
        </td>
      </tr></table>

      <p style="color:#6b7280;font-size:12px;margin-top:20px;">
        Full data is attached as Excel (sheets: Below MOP, Penalty Report, Audit Report).<br/>
        Generated at {datetime.now().strftime("%d %b %Y, %I:%M %p")}
      </p>
    </div>
    """
