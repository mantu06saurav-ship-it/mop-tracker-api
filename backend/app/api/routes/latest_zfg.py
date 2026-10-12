from fastapi import APIRouter, HTTPException, UploadFile
from sqlalchemy import text

from app.core.constants import LATEST_ZFG_FIELD_DEFS, LATEST_ZFG_HEADER_ALIASES
from app.db.session import get_conn
from app.services.excel_service import get_value, has_any_alias, parse_field_value, read_excel

router = APIRouter(tags=["latest-zfg"])


def _aliases_for(field: str) -> list[str]:
    return LATEST_ZFG_HEADER_ALIASES.get(field, [field.replace("_", " ").upper()])


@router.get("/latest-zfg-status")
def latest_zfg_status():
    with get_conn() as conn:
        exists = conn.execute(text("SELECT OBJECT_ID('dbo.latest_zfg') AS id")).fetchone().id is not None
        if not exists:
            return {"exists": False}
        columns = conn.execute(
            text(
                "SELECT COLUMN_NAME AS name, DATA_TYPE AS type, CHARACTER_MAXIMUM_LENGTH AS max_length "
                "FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='dbo' AND TABLE_NAME='latest_zfg'"
            )
        ).fetchall()
        row_count = conn.execute(text("SELECT COUNT(*) AS c FROM dbo.latest_zfg")).fetchone().c
    return {"exists": True, "columns": [dict(c._mapping) for c in columns], "row_count": row_count}


@router.post("/upload-latest-zfg")
async def upload_latest_zfg(file: UploadFile):
    content = await file.read()
    rows = read_excel(content)

    if rows and not has_any_alias(set(rows[0].keys()), LATEST_ZFG_HEADER_ALIASES["sku"]):
        raise HTTPException(status_code=400, detail="Missing required SKU column")

    with get_conn() as conn:
        existing = {
            r.sku: r.id for r in conn.execute(text("SELECT id, sku FROM dbo.latest_zfg")).fetchall()
        }

        inserted = updated = skipped = 0
        for row in rows:
            try:
                sku = str(get_value(row, LATEST_ZFG_HEADER_ALIASES["sku"])).strip()
                if not sku:
                    skipped += 1
                    continue

                values = {}
                for field, _sql_type, parse_kind in LATEST_ZFG_FIELD_DEFS:
                    if field == "sku":
                        continue
                    values[field] = parse_field_value(get_value(row, _aliases_for(field)), parse_kind)

                if sku in existing:
                    set_clause = ", ".join(f"{f} = :{f}" for f in values)
                    conn.execute(
                        text(f"UPDATE dbo.latest_zfg SET {set_clause} WHERE id = :id"),
                        {**values, "id": existing[sku]},
                    )
                    updated += 1
                else:
                    columns = ["sku"] + list(values.keys())
                    placeholders = ", ".join(f":{c}" for c in columns)
                    result = conn.execute(
                        text(
                            f"INSERT INTO dbo.latest_zfg ({', '.join(columns)}) "
                            f"OUTPUT INSERTED.id VALUES ({placeholders})"
                        ),
                        {**values, "sku": sku},
                    )
                    existing[sku] = result.fetchone().id
                    inserted += 1
            except Exception:
                skipped += 1

    return {"total_rows_in_file": len(rows), "inserted": inserted, "updated": updated, "skipped_invalid": skipped}


@router.get("/latest-zfg-data")
def latest_zfg_data():
    with get_conn() as conn:
        rows = [dict(r._mapping) for r in conn.execute(text("SELECT * FROM dbo.latest_zfg")).fetchall()]

    total_rows = len(rows)
    total_skus = len({r["sku"] for r in rows if r.get("sku")})
    total_brands = len({r["brand"] for r in rows if r.get("brand")})
    total_classes = len({r["class"] for r in rows if r.get("class")})
    total_requirement = sum(r.get("requirement") or 0 for r in rows)

    return {
        "rows": rows,
        "summary": {
            "total_rows": total_rows,
            "total_skus": total_skus,
            "total_brands": total_brands,
            "total_classes": total_classes,
            "total_requirement": total_requirement,
        },
    }
