"""Every item a spider yields represents a scrape attempt that DID NOT raise (mirrors the Node
scrapers, which always catch their own errors internally and return a normal result object with
scrap_status describing the failure, e.g. "ERROR: HTTP 503"). Such items still count as a
successfully-processed record: inserted into dbo.mop_tracker and pushed into the job's `rows`.

A spider's `errback` handles the other case — a genuinely uncaught exception (network/timeout
at the Twisted level) — which increments the job's `errors` counter directly and never reaches
this pipeline, matching the Node per-record try/catch that increments `errors` without a DB
insert.
"""

import logging

from sqlalchemy import text

from app.db.session import get_conn
from app.services.job_store import job_store

logger = logging.getLogger("mop_tracker.pipeline")

_INSERT_SQL = text(
    """
    INSERT INTO dbo.mop_tracker
        (batch_id, portal, code_type, code, sku, mop, title, price_scraped, mrp,
         rating, reviews, seller, product_url, image_url, inventory_status,
         scrap_status, price_status)
    VALUES
        (:batch_id, :portal, :code_type, :code, :sku, :mop, :title, :price_scraped, :mrp,
         :rating, :reviews, :seller, :product_url, :image_url, :inventory_status,
         :scrap_status, :price_status)
    """
)

_DB_COLUMNS = [
    "batch_id", "portal", "code_type", "code", "sku", "mop", "title", "price_scraped", "mrp",
    "rating", "reviews", "seller", "product_url", "image_url", "inventory_status",
    "scrap_status", "price_status",
]


# dbo.mop_tracker column widths. SQL Server rejects the whole INSERT when one value is too long
# (e.g. an exception message landing in scrap_status), which silently lost the row, so values
# are clipped to fit instead.
_MAX_LENGTHS = {
    "batch_id": 50, "portal": 50, "code_type": 20, "code": 100, "sku": 100, "title": 500,
    "reviews": 50, "seller": 200, "product_url": 1000, "image_url": 1000,
    "inventory_status": 30, "scrap_status": 50, "price_status": 20,
}


class MopTrackerPipeline:
    def process_item(self, item, spider):
        row = {col: item.get(col) for col in _DB_COLUMNS}
        for col, max_len in _MAX_LENGTHS.items():
            if isinstance(row[col], str) and len(row[col]) > max_len:
                row[col] = row[col][:max_len]
        batch_id = row["batch_id"]

        try:
            with get_conn() as conn:
                conn.execute(_INSERT_SQL, row)
            job_store.record_insert(batch_id)
        except Exception as exc:  # noqa: BLE001 — one bad insert must not abort the batch
            logger.error("DB insert failed for %s %s: %s", row.get("portal"), row.get("code"), exc)
            job_store.record_db_error(batch_id, str(exc))

        # Still counted as "done" and kept in the job's row list even if the DB insert failed,
        # matching the Node behaviour ("the scraped row is still pushed ... even if the DB write
        # failed").
        job_store.record_success(batch_id, row)
        return item
