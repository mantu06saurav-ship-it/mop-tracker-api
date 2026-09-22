from datetime import datetime

from fastapi import APIRouter, Query, Response

from app.services.dashboard_service import (
    get_batches,
    get_compliance_daily,
    get_dashboard,
    get_portal_breakdown,
    get_trends,
    get_latest_report_rows,
    build_summary,
)
from app.services.excel_service import build_xlsx, file_stamp

router = APIRouter(tags=["reports"])

_REPORT_COLUMN_MAP = {
    "id": "ID",
    "batch_id": "Batch ID",
    "portal": "Portal",
    "code_type": "Code Type",
    "code": "Code",
    "sku": "SKU",
    "mop": "MOP",
    "title": "Title",
    "price_scraped": "Scraped Price",
    "mrp": "MRP",
    "rating": "Rating",
    "reviews": "Reviews",
    "seller": "Seller",
    "product_url": "Product URL",
    "inventory_status": "Inventory Status",
    "scrap_status": "Scrape Status",
    "price_status": "Price Status",
    "scraped_at": "Scraped At",
}


@router.get("/dashboard")
def dashboard():
    return get_dashboard()


@router.get("/batches")
def batches():
    return get_batches()


@router.get("/api/trends")
def trends():
    return {"batches": get_trends()}


@router.get("/api/portal-breakdown")
def portal_breakdown():
    return get_portal_breakdown()


@router.get("/api/compliance-daily")
def compliance_daily(days: int = Query(default=14, ge=1, le=90)):
    return get_compliance_daily(days)


@router.get("/report/download")
def report_download():
    rows = get_latest_report_rows()
    summary = build_summary(rows)

    summary_rows = [
        {"Metric": "Total SKUs", "Value": summary["total"]},
        {"Metric": "Below MOP", "Value": summary["below_mop"]},
        {"Metric": "At MOP", "Value": summary["at_mop"]},
        {"Metric": "Above MOP", "Value": summary["above_mop"]},
        {"Metric": "Unknown", "Value": summary["unknown"]},
        {"Metric": "Compliance %", "Value": summary["compliance_pct"]},
        {"Metric": "Generated At", "Value": datetime.now().strftime("%d %b %Y, %I:%M %p")},
    ]

    report_rows = []
    for r in rows:
        renamed = {}
        for key, label in _REPORT_COLUMN_MAP.items():
            if key in r:
                renamed[label] = r[key]
        report_rows.append(renamed)

    xlsx_bytes = build_xlsx({"Summary": summary_rows, "Report": report_rows})
    filename = f"mop_tracker_report_{file_stamp()}.xlsx"
    return Response(
        content=xlsx_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
