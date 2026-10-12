from datetime import datetime

from fastapi import APIRouter, Response

from app.services.audit_service import build_audit_blocks, build_audit_report_rows, summarize_audit_blocks
from app.services.excel_service import build_xlsx, file_stamp

router = APIRouter(prefix="/api/audit-report", tags=["audit"])


@router.get("")
def audit_report():
    blocks = build_audit_blocks()
    return {"blocks": blocks, "generated_at": datetime.now().isoformat()}


@router.get("/download")
def audit_report_download():
    blocks = build_audit_blocks()
    summary = summarize_audit_blocks(blocks)

    total_listings = len(blocks)
    total_skus = len({b["sku"] for b in blocks})

    summary_rows = [
        {"Metric": "Total Listings", "Value": total_listings},
        {"Metric": "Total SKUs", "Value": total_skus},
        {"Metric": "Missing ZFG Data", "Value": summary["missingZfg"]},
        {"Metric": "Field Checks (NOT_OK)", "Value": summary["notOkFields"]},
        {"Metric": "Generated At", "Value": datetime.now().strftime("%d %b %Y, %I:%M %p")},
    ]
    audit_rows = build_audit_report_rows(blocks)

    xlsx_bytes = build_xlsx({"Summary": summary_rows, "Audit Report": audit_rows})
    filename = f"audit_report_{file_stamp()}.xlsx"
    return Response(
        content=xlsx_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
