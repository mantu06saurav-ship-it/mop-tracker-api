import re
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text

from app.api.deps import require_admin
from app.db.session import get_conn
from app.schemas.misc import EmailSettingsRequest, SendBelowMopReportRequest
from app.services import email_state
from app.services.dashboard_service import get_latest_report_rows
from app.services.email_service import build_below_mop_html, save_email_delivery, send_email
from app.services.excel_service import build_xlsx, file_stamp
from app.services.snapshot_service import deliver_daily_snapshot_email, email_schedule_status

router = APIRouter(tags=["email"])

_SEND_TIME_RE = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")


def _get_settings_row() -> dict:
    with get_conn() as conn:
        row = conn.execute(text("SELECT * FROM dbo.email_settings WHERE id = 1")).fetchone()
    return dict(row._mapping) if row else {}


@router.get("/api/email-settings")
def get_email_settings(_: dict = Depends(require_admin)):
    settings_row = _get_settings_row()
    today_str = datetime.now().strftime("%Y-%m-%d")
    return {
        "settings": settings_row,
        "schedule_status": email_schedule_status(settings_row, today_str, email_state.is_sending()),
        "timezone": "Asia/Kolkata",
    }


@router.put("/api/email-settings")
def update_email_settings(body: EmailSettingsRequest, admin: dict = Depends(require_admin)):
    if body.mode not in ("auto", "manual"):
        raise HTTPException(status_code=400, detail="mode must be 'auto' or 'manual'")
    if not _SEND_TIME_RE.match(body.sendTime):
        raise HTTPException(status_code=400, detail="sendTime must be in HH:MM 24h format")
    if body.mode == "auto" and body.enabled and not body.toEmails:
        raise HTTPException(status_code=400, detail="At least one recipient is required to enable automatic sending")

    with get_conn() as conn:
        conn.execute(
            text(
                """
                UPDATE dbo.email_settings SET
                    mode = :mode, to_emails = :to_emails, cc_emails = :cc_emails,
                    send_time = :send_time, enabled = :enabled, updated_by = :updated_by, updated_at = GETDATE()
                WHERE id = 1
                """
            ),
            {
                "mode": body.mode,
                "to_emails": ", ".join(body.toEmails),
                "cc_emails": ", ".join(body.ccEmails),
                "send_time": body.sendTime,
                "enabled": body.enabled,
                "updated_by": admin["email"],
            },
        )
    return {"settings": _get_settings_row()}


@router.post("/api/email-settings/send-now")
def send_now(admin: dict = Depends(require_admin)):
    if not email_state.try_acquire():
        raise HTTPException(status_code=409, detail="A snapshot email is already being sent")
    try:
        settings_row = _get_settings_row()
        to_emails = [e.strip() for e in (settings_row.get("to_emails") or "").split(",") if e.strip()]
        cc_emails = [e.strip() for e in (settings_row.get("cc_emails") or "").split(",") if e.strip()]
        if not to_emails:
            raise HTTPException(status_code=400, detail="No recipients configured")

        receipt = deliver_daily_snapshot_email(to_emails, cc_emails)
        today_str = datetime.now().strftime("%Y-%m-%d")
        with get_conn() as conn:
            conn.execute(
                text("UPDATE dbo.email_settings SET last_sent_date = :d, last_sent_at = GETDATE() WHERE id = 1"),
                {"d": today_str},
            )
        return {"sent": receipt.get("status") in ("accepted", "partial"), "receipt": receipt}
    finally:
        email_state.release()


@router.post("/send-below-mop-report")
def send_below_mop_report(body: SendBelowMopReportRequest):
    rows = [r for r in get_latest_report_rows() if r.get("price_status") == "BELOW_MOP"]
    html = build_below_mop_html(rows)

    attachments = []
    if rows:
        xlsx_bytes = build_xlsx({"Below MOP": rows})
        attachments.append((f"below_mop_{file_stamp()}.xlsx", xlsx_bytes))

    subject = f"MOP Tracker — {len(rows)} SKU(s) Below MOP"
    receipt = send_email([str(body.to)], subject, html, attachments=attachments)
    save_email_delivery(receipt)

    return {"sent": receipt.get("status") in ("accepted", "partial"), "to": str(body.to), "below_mop_count": len(rows)}
