from fastapi import APIRouter, HTTPException, UploadFile
from sqlalchemy import text

from app.core.constants import INVENTORY_FIELD_DEFS, INVENTORY_HEADER_ALIASES
from app.db.session import get_conn
from app.services.excel_service import get_value, has_any_alias, parse_field_value, read_excel

router = APIRouter(tags=["inventory"])


@router.get("/inventory-data-status")
def inventory_data_status():
    with get_conn() as conn:
        exists = conn.execute(text("SELECT OBJECT_ID('dbo.inventory_data') AS id")).fetchone().id is not None
        if not exists:
            return {"exists": False}
        columns = conn.execute(
            text(
                "SELECT COLUMN_NAME AS name, DATA_TYPE AS type, CHARACTER_MAXIMUM_LENGTH AS max_length "
                "FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='dbo' AND TABLE_NAME='inventory_data'"
            )
        ).fetchall()
        row_count = conn.execute(text("SELECT COUNT(*) AS c FROM dbo.inventory_data")).fetchone().c
    return {"exists": True, "columns": [dict(c._mapping) for c in columns], "row_count": row_count}


@router.post("/upload-inventory-data")
async def upload_inventory_data(file: UploadFile):
    content = await file.read()
    rows = read_excel(content)

    if rows and not has_any_alias(set(rows[0].keys()), INVENTORY_HEADER_ALIASES["sku_code"]):
        raise HTTPException(status_code=400, detail="Missing required SKU column")

    with get_conn() as conn:
        existing = {
            (r.sku_code, r.batch or "", r.shelf or ""): r.id
            for r in conn.execute(text("SELECT id, sku_code, batch, shelf FROM dbo.inventory_data")).fetchall()
        }

        inserted = updated = skipped = 0
        for row in rows:
            try:
                sku_code = str(get_value(row, INVENTORY_HEADER_ALIASES["sku_code"])).strip()
                if not sku_code:
                    skipped += 1
                    continue

                values = {}
                for column, aliases, parse_kind in INVENTORY_FIELD_DEFS:
                    values[column] = parse_field_value(get_value(row, aliases), parse_kind)
                batch = values.get("batch") or ""
                shelf = values.get("shelf") or ""
                key = (sku_code, batch, shelf)

                if key in existing:
                    set_clause = ", ".join(f"{c} = :{c}" for c, _, _ in INVENTORY_FIELD_DEFS)
                    conn.execute(
                        text(f"UPDATE dbo.inventory_data SET {set_clause} WHERE id = :id"),
                        {**values, "id": existing[key]},
                    )
                    updated += 1
                else:
                    columns = ["sku_code"] + [c for c, _, _ in INVENTORY_FIELD_DEFS]
                    placeholders = ", ".join(f":{c}" for c in columns)
                    result = conn.execute(
                        text(
                            f"INSERT INTO dbo.inventory_data ({', '.join(columns)}) "
                            f"OUTPUT INSERTED.id VALUES ({placeholders})"
                        ),
                        {**values, "sku_code": sku_code},
                    )
                    existing[key] = result.fetchone().id
                    inserted += 1
            except Exception:
                skipped += 1

    return {"total_rows_in_file": len(rows), "inserted": inserted, "updated": updated, "skipped_invalid": skipped}


@router.get("/inventory-data")
def inventory_data():
    with get_conn() as conn:
        rows = [dict(r._mapping) for r in conn.execute(text("SELECT * FROM dbo.inventory_data")).fetchall()]

    total_rows = len(rows)
    total_skus = len({r["sku_code"] for r in rows if r.get("sku_code")})
    total_stock_on_hand = sum(r.get("stock_on_hand") or 0 for r in rows)
    total_available_atp = sum(r.get("available_atp") or 0 for r in rows)
    total_batches = len({r["batch"] for r in rows if r.get("batch")})
    total_brands = len({r["brand"] for r in rows if r.get("brand")})

    return {
        "rows": rows,
        "summary": {
            "total_rows": total_rows,
            "total_skus": total_skus,
            "total_stock_on_hand": total_stock_on_hand,
            "total_available_atp": total_available_atp,
            "total_batches": total_batches,
            "total_brands": total_brands,
        },
    }
