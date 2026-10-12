from fastapi import APIRouter, Form, HTTPException, UploadFile
from sqlalchemy import text

from app.core.constants import MOP_DATA_HEADER_ALIASES
from app.db.session import get_conn
from app.scraping.utils import parse_price
from app.services.excel_service import get_value, has_any_alias, read_excel

router = APIRouter(tags=["mop-data"])


@router.get("/mop-data-status")
def mop_data_status():
    with get_conn() as conn:
        exists = conn.execute(text("SELECT OBJECT_ID('dbo.mop_data') AS id")).fetchone().id is not None
        if not exists:
            return {"exists": False}
        columns = conn.execute(
            text(
                "SELECT COLUMN_NAME AS name, DATA_TYPE AS type, CHARACTER_MAXIMUM_LENGTH AS max_length "
                "FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='dbo' AND TABLE_NAME='mop_data'"
            )
        ).fetchall()
        row_count = conn.execute(text("SELECT COUNT(*) AS c FROM dbo.mop_data")).fetchone().c
    return {"exists": True, "columns": [dict(c._mapping) for c in columns], "row_count": row_count}


@router.post("/upload-mop-data")
async def upload_mop_data(file: UploadFile, override: str = Form(default="")):
    allow_override = override.strip().lower() in ("true", "1")
    content = await file.read()
    rows = read_excel(content)

    if rows:
        columns = set(rows[0].keys())
        missing = [
            field for field, aliases in MOP_DATA_HEADER_ALIASES.items() if not has_any_alias(columns, aliases)
        ]
        if missing:
            raise HTTPException(
                status_code=400,
                detail=f"Missing required column(s): {', '.join(missing)}. Found columns: {', '.join(sorted(columns))}",
            )

    with get_conn() as conn:
        existing = {
            (r.portal.lower(), r.code)
            for r in conn.execute(text("SELECT portal, code FROM dbo.mop_data")).fetchall()
        }

        seen_in_file: set[tuple[str, str]] = set()
        inserted = updated = skipped = 0

        for row in rows:
            brand = str(get_value(row, MOP_DATA_HEADER_ALIASES["brand"])).strip()
            portal = str(get_value(row, MOP_DATA_HEADER_ALIASES["portal"])).strip()
            code = str(get_value(row, MOP_DATA_HEADER_ALIASES["code"])).strip()
            code_type = str(get_value(row, MOP_DATA_HEADER_ALIASES["code_type"])).strip()
            sku_code = str(get_value(row, MOP_DATA_HEADER_ALIASES["sku_code"])).strip()
            mop = parse_price(get_value(row, MOP_DATA_HEADER_ALIASES["mop"]))
            mop_for = str(get_value(row, ["MOP FOR"])).strip()

            if not brand or not portal or not code or mop is None:
                skipped += 1
                continue

            key = (portal.lower(), code)
            if key in seen_in_file:
                skipped += 1
                continue

            if key in existing:
                if not allow_override:
                    skipped += 1
                    continue
                conn.execute(
                    text(
                        """
                        UPDATE dbo.mop_data SET brand=:brand, code_type=:code_type, sku_code=:sku_code,
                               mop_for=:mop_for, mop=:mop
                        WHERE portal = :portal AND code = :code
                        """
                    ),
                    {"brand": brand, "code_type": code_type, "sku_code": sku_code, "mop_for": mop_for, "mop": mop, "portal": portal, "code": code},
                )
                updated += 1
            else:
                conn.execute(
                    text(
                        """
                        INSERT INTO dbo.mop_data (brand, portal, code_type, code, sku_code, mop_for, mop)
                        VALUES (:brand, :portal, :code_type, :code, :sku_code, :mop_for, :mop)
                        """
                    ),
                    {"brand": brand, "portal": portal, "code_type": code_type, "code": code, "sku_code": sku_code, "mop_for": mop_for, "mop": mop},
                )
                inserted += 1

            seen_in_file.add(key)

    return {
        "total_rows_in_file": len(rows),
        "inserted": inserted,
        "updated": updated,
        "skipped_duplicates_or_invalid": skipped,
    }
