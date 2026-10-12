"""Excel upload/download helpers — Python equivalent of the Node app's `readExcel()` +
`cleanHeader()` (SheetJS-based) pipeline, now backed by openpyxl/pandas.
"""

import io
import re

import pandas as pd


def clean_header(raw: str) -> str:
    """'code_type', 'Code-Type', ' code type ' all become 'CODE TYPE'."""
    s = str(raw).strip()
    s = re.sub(r":\s*$", "", s)
    s = re.sub(r"[\s_-]+", " ", s)
    return s.strip().upper()


def read_excel(file_bytes: bytes) -> list[dict]:
    """Reads the first sheet, cleans headers, and returns a list of row dicts with empty-string
    defaults for blank cells (mirrors SheetJS's `sheet_to_json(ws, {defval: ""})`)."""
    df = pd.read_excel(io.BytesIO(file_bytes), sheet_name=0, dtype=object)
    df.columns = [clean_header(c) for c in df.columns]
    df = df.fillna("")
    return df.to_dict(orient="records")


def find_alias_key(row: dict, aliases: list[str]) -> str | None:
    for alias in aliases:
        if alias in row:
            return alias
    return None


def has_any_alias(columns: set[str], aliases: list[str]) -> bool:
    return any(alias in columns for alias in aliases)


def get_value(row: dict, aliases: list[str], default=""):
    key = find_alias_key(row, aliases)
    if key is None:
        return default
    value = row[key]
    if value is None:
        return default
    return value


def build_xlsx(sheets: dict[str, list[dict]]) -> bytes:
    """sheets: {"Sheet Name": [ {col: value, ...}, ... ]}. Preserves key order per-sheet from
    the first row (openpyxl doesn't reorder dict keys, matching SheetJS's json_to_sheet)."""
    buf = io.BytesIO()
    with pd.ExcelWriter(buf, engine="openpyxl") as writer:
        for name, rows in sheets.items():
            df = pd.DataFrame(rows) if rows else pd.DataFrame()
            df.to_excel(writer, sheet_name=name[:31], index=False)
    buf.seek(0)
    return buf.read()


def file_stamp() -> str:
    from datetime import datetime

    return datetime.now().strftime("%Y%m%d_%H%M%S")


def parse_field_value(raw, parse_kind: str):
    """Shared cell-value coercion for the inventory_data / latest_zfg bulk uploads."""
    from datetime import datetime

    if raw is None or (isinstance(raw, str) and not raw.strip()):
        return None

    if parse_kind == "str":
        s = str(raw).strip()
        return s or None

    if parse_kind in ("float", "int"):
        s = str(raw).strip().replace(",", "")
        if not s:
            return None
        try:
            value = float(s)
        except ValueError:
            return None
        return int(round(value)) if parse_kind == "int" else value

    if parse_kind == "bit":
        s = str(raw).strip().lower()
        if s in ("1", "true", "yes", "y"):
            return True
        if s in ("0", "false", "no", "n"):
            return False
        return None

    if parse_kind == "date":
        if isinstance(raw, datetime):
            return raw
        s = str(raw).strip()
        for fmt in ("%d-%m-%Y %H:%M", "%d-%m-%Y", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
            try:
                return datetime.strptime(s, fmt)
            except ValueError:
                continue
        try:
            return datetime.fromisoformat(s)
        except ValueError:
            return None

    return raw
