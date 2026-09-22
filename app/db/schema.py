"""Creates/upgrades all tables on startup — mirrors the Node app's ensure-table-exists pattern
so this backend can run against a brand-new database (or the shared MSSQL instance) without a
separate migration step.
"""

import logging

from sqlalchemy import text

from app.core.constants import LATEST_ZFG_FIELD_DEFS, SEED_SELLER_MAPPING
from app.db.session import get_conn

logger = logging.getLogger("mop_tracker.schema")


def _table_exists(conn, name: str) -> bool:
    row = conn.execute(text("SELECT OBJECT_ID(:name) AS id"), {"name": f"dbo.{name}"}).fetchone()
    return row is not None and row.id is not None


def _column_exists(conn, table: str, column: str) -> bool:
    row = conn.execute(
        text("SELECT COL_LENGTH(:table, :column) AS len"),
        {"table": f"dbo.{table}", "column": column},
    ).fetchone()
    return row is not None and row.len is not None


def _add_column_if_missing(conn, table: str, column: str, ddl_type: str) -> None:
    if not _column_exists(conn, table, column):
        conn.execute(text(f"ALTER TABLE dbo.{table} ADD {column} {ddl_type}"))
        logger.info("Added missing column %s.%s", table, column)


def ensure_mop_tracker(conn) -> None:
    if not _table_exists(conn, "mop_tracker"):
        conn.execute(
            text(
                """
                CREATE TABLE dbo.mop_tracker (
                    id INT IDENTITY(1,1) PRIMARY KEY,
                    batch_id VARCHAR(50),
                    portal VARCHAR(50),
                    code_type VARCHAR(20),
                    code VARCHAR(100),
                    sku VARCHAR(100),
                    mop FLOAT,
                    title NVARCHAR(500),
                    price_scraped FLOAT,
                    mrp FLOAT,
                    rating FLOAT,
                    reviews VARCHAR(50),
                    seller NVARCHAR(200),
                    product_url NVARCHAR(1000),
                    image_url NVARCHAR(1000),
                    inventory_status VARCHAR(30),
                    scrap_status VARCHAR(50),
                    price_status VARCHAR(20),
                    scraped_at DATETIME DEFAULT GETDATE()
                )
                """
            )
        )
    else:
        _add_column_if_missing(conn, "mop_tracker", "image_url", "NVARCHAR(1000)")
        _add_column_if_missing(conn, "mop_tracker", "inventory_status", "VARCHAR(30)")


def ensure_mop_data(conn) -> None:
    if not _table_exists(conn, "mop_data"):
        conn.execute(
            text(
                """
                CREATE TABLE dbo.mop_data (
                    id INT IDENTITY(1,1) PRIMARY KEY,
                    brand NVARCHAR(200),
                    portal VARCHAR(50) NOT NULL,
                    code_type VARCHAR(20),
                    code VARCHAR(100) NOT NULL,
                    sku_code VARCHAR(100),
                    mop_for VARCHAR(100),
                    mop FLOAT,
                    created_at DATETIME DEFAULT GETDATE()
                )
                """
            )
        )
    else:
        _add_column_if_missing(conn, "mop_data", "mop_for", "VARCHAR(100)")

    try:
        conn.execute(
            text(
                """
                IF NOT EXISTS (
                    SELECT 1 FROM sys.key_constraints
                    WHERE name = 'UQ_mop_data_portal_code' AND parent_object_id = OBJECT_ID('dbo.mop_data')
                )
                ALTER TABLE dbo.mop_data ADD CONSTRAINT UQ_mop_data_portal_code UNIQUE (portal, code)
                """
            )
        )
    except Exception:
        logger.warning("Could not add UQ_mop_data_portal_code (likely pre-existing duplicate rows) — app-level dedup still applies.")


def ensure_inventory_data(conn) -> None:
    if not _table_exists(conn, "inventory_data"):
        conn.execute(
            text(
                """
                CREATE TABLE dbo.inventory_data (
                    id INT IDENTITY(1,1) PRIMARY KEY,
                    inventory_type VARCHAR(50),
                    sku_code VARCHAR(100) NOT NULL,
                    item_name NVARCHAR(300),
                    shelf VARCHAR(50) NOT NULL DEFAULT '',
                    batch VARCHAR(50) NOT NULL DEFAULT '',
                    batch_status VARCHAR(50),
                    stock_on_hand INT,
                    available_atp INT,
                    blocked_committed INT,
                    not_found INT,
                    cost FLOAT,
                    color VARCHAR(50),
                    brand NVARCHAR(200),
                    source_updated_at DATETIME,
                    status VARCHAR(30),
                    inventory_allocation BIT,
                    inventory_variance BIT,
                    stock_miskeeping BIT,
                    image_url NVARCHAR(1000),
                    pendency_all_channels INT,
                    total_inventory INT,
                    uploaded_by NVARCHAR(200),
                    uploaded_at DATETIME DEFAULT GETDATE(),
                    CONSTRAINT UQ_inventory_data_sku_batch_shelf UNIQUE (sku_code, batch, shelf)
                )
                """
            )
        )


def ensure_latest_zfg(conn) -> None:
    if not _table_exists(conn, "latest_zfg"):
        cols_sql = ",\n                    ".join(f"{f} {t}" for f, t, _ in LATEST_ZFG_FIELD_DEFS)
        conn.execute(
            text(
                f"""
                CREATE TABLE dbo.latest_zfg (
                    id INT IDENTITY(1,1) PRIMARY KEY,
                    {cols_sql},
                    uploaded_by NVARCHAR(200),
                    uploaded_at DATETIME DEFAULT GETDATE(),
                    CONSTRAINT UQ_latest_zfg_sku UNIQUE (sku)
                )
                """
            )
        )
    else:
        _add_column_if_missing(conn, "latest_zfg", "size_level", "VARCHAR(50)")
        _add_column_if_missing(conn, "latest_zfg", "sap_indicator", "VARCHAR(50)")


def ensure_users(conn) -> None:
    if not _table_exists(conn, "Users"):
        conn.execute(
            text(
                """
                CREATE TABLE dbo.Users (
                    UserId BIGINT IDENTITY(1,1) PRIMARY KEY,
                    EmployeeCode NVARCHAR(20) NOT NULL UNIQUE,
                    FirstName NVARCHAR(100) NOT NULL,
                    LastName NVARCHAR(100) NULL,
                    Email NVARCHAR(255) NOT NULL UNIQUE,
                    PhoneNumber NVARCHAR(20) NULL,
                    PasswordHash NVARCHAR(500) NOT NULL,
                    Role NVARCHAR(50) NOT NULL CONSTRAINT CK_Users_Role_3 CHECK (Role IN ('Super Admin','Manager','Viewer')),
                    Designation NVARCHAR(100) NOT NULL,
                    Department NVARCHAR(100) NULL,
                    ReportingManagerId BIGINT NULL,
                    ProfileImageUrl NVARCHAR(500) NULL,
                    IsEmailVerified BIT NOT NULL DEFAULT 0,
                    IsActive BIT NOT NULL DEFAULT 1,
                    IsDeleted BIT NOT NULL DEFAULT 0,
                    LastLogin DATETIME2 NULL,
                    CreatedAt DATETIME2 NOT NULL DEFAULT GETDATE(),
                    UpdatedAt DATETIME2 NULL,
                    CreatedBy NVARCHAR(100) NULL,
                    UpdatedBy NVARCHAR(100) NULL,
                    CONSTRAINT FK_Users_Manager FOREIGN KEY (ReportingManagerId) REFERENCES dbo.Users(UserId)
                )
                """
            )
        )


def ensure_seller_mapping(conn) -> None:
    created = False
    if not _table_exists(conn, "seller_mapping"):
        conn.execute(
            text(
                """
                CREATE TABLE dbo.seller_mapping (
                    id INT IDENTITY(1,1) PRIMARY KEY,
                    seller NVARCHAR(200) NOT NULL,
                    portal VARCHAR(50) NOT NULL,
                    sub_type VARCHAR(20),
                    vertical_head NVARCHAR(100),
                    kam NVARCHAR(100),
                    created_at DATETIME DEFAULT GETDATE(),
                    updated_at DATETIME,
                    email_active BIT NOT NULL DEFAULT 1,
                    CONSTRAINT UQ_seller_mapping_seller_portal UNIQUE (seller, portal)
                )
                """
            )
        )
        created = True
    else:
        _add_column_if_missing(conn, "seller_mapping", "email_active", "BIT NOT NULL DEFAULT 1")

    if created:
        for row in SEED_SELLER_MAPPING:
            conn.execute(
                text(
                    """
                    INSERT INTO dbo.seller_mapping (seller, portal, sub_type, vertical_head, kam)
                    VALUES (:seller, :portal, :sub_type, :vertical_head, :kam)
                    """
                ),
                row,
            )


def ensure_email_settings(conn) -> None:
    if not _table_exists(conn, "email_settings"):
        conn.execute(
            text(
                """
                CREATE TABLE dbo.email_settings (
                    id INT PRIMARY KEY,
                    mode VARCHAR(10) NOT NULL DEFAULT 'manual',
                    to_emails NVARCHAR(1000),
                    cc_emails NVARCHAR(1000),
                    send_time VARCHAR(5) NOT NULL DEFAULT '09:00',
                    enabled BIT NOT NULL DEFAULT 0,
                    last_sent_date VARCHAR(10),
                    last_sent_at DATETIME,
                    updated_by NVARCHAR(150),
                    updated_at DATETIME,
                    last_delivery NVARCHAR(MAX)
                )
                """
            )
        )
        conn.execute(text("INSERT INTO dbo.email_settings (id, mode, send_time, enabled) VALUES (1, 'manual', '09:00', 0)"))
    else:
        _add_column_if_missing(conn, "email_settings", "last_delivery", "NVARCHAR(MAX)")


def ensure_all_tables() -> None:
    with get_conn() as conn:
        ensure_mop_tracker(conn)
        ensure_mop_data(conn)
        ensure_inventory_data(conn)
        ensure_latest_zfg(conn)
        ensure_users(conn)
        ensure_seller_mapping(conn)
        ensure_email_settings(conn)
    logger.info("Database schema check complete.")
