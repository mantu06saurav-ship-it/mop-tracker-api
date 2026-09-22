from fastapi import APIRouter, Query

from app.services.dashboard_service import get_latest_report_rows

router = APIRouter(tags=["catalog"])

_PUBLIC_FIELDS = ["portal", "title", "price_scraped", "mrp", "rating", "reviews", "seller", "product_url", "image_url", "inventory_status"]


@router.get("/api/products/public")
def public_products(limit: int = Query(default=20, ge=1, le=2000), page: int = Query(default=1, ge=1)):
    rows = [
        r for r in get_latest_report_rows()
        if r.get("scrap_status") == "SUCCESS" and r.get("title") and r.get("price_scraped") is not None
    ]

    total_pages = max(1, (len(rows) + limit - 1) // limit)
    page = min(page, total_pages)
    start = (page - 1) * limit
    page_rows = rows[start : start + limit]

    products = [{field: r.get(field) for field in _PUBLIC_FIELDS} for r in page_rows]

    return {"count": len(rows), "page": page, "limit": limit, "total_pages": total_pages, "products": products}
