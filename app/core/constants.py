USER_ROLES = ["Super Admin", "Manager", "Viewer"]
ADMIN_ROLES = ["Super Admin"]

AUTO_SCRAPE_CRON = "0 0,6,12,18 * * *"
AUTO_SCRAPE_PORTALS = ["flipkart", "amazon", "myntra", "snapdeal", "ajio"]
DEFAULT_PINCODE = "110001"

BROWSER_PORTALS = {"flipkart", "myntra", "ajio"}
BROWSER_RECYCLE_EVERY = 40

AVATAR_MIME_EXT = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/webp": "webp",
    "image/gif": "gif",
}
AVATAR_MAX_BYTES = 3 * 1024 * 1024

PENALTY_PORTAL_COLS = [
    {"key": "flipkart", "label": "Flipkart"},
    {"key": "myntra", "label": "Myntra"},
    {"key": "amazon", "label": "Amazon"},
    {"key": "snapdeal", "label": "Snapdeal"},
    {"key": "ajio", "label": "Ajio"},
]
PENALTY_VH_RATE = 250
PENALTY_KAM_RATE = 250
PENALTY_RATE = PENALTY_VH_RATE + PENALTY_KAM_RATE  # 500 per breached article
PENALTY_GAP_TOLERANCE = 15

# Excel upload header aliases (uppercased, whitespace/separators collapsed to single space)
MOP_DATA_HEADER_ALIASES = {
    "brand": ["BRAND"],
    "portal": ["PORTAL"],
    "code_type": ["CODE TYPE"],
    "code": ["CODE"],
    "sku_code": ["SKU CODE", "SKU", "SKUCODE"],
    "mop": ["MOP", "MOP FOR MINIMUM OPERATING PRICE", "MINIMUM OPERATING PRICE"],
}
MOP_DATA_OPTIONAL_ALIASES = {
    "mop_for": ["MOP FOR"],
}

INVENTORY_HEADER_ALIASES = {
    "sku_code": ["SKU CODE", "SKU", "SKUCODE", "MATERIAL"],
}

# [db_column, aliases, parse_kind] — parse_kind in {"str", "int", "float", "date", "bit"}.
# NOTE: the Node app's exact alias lists for these two optional-column uploads weren't
# recoverable from source (only noted as "full alias lists captured in code" in the audit) —
# these are reasonable defaults inferred from the column names; adjust to match your actual
# warehouse/SAP export headers if they differ.
INVENTORY_FIELD_DEFS = [
    ("inventory_type", ["INVENTORY TYPE", "TYPE"], "str"),
    ("item_name", ["ITEM NAME", "ITEM", "PRODUCT NAME"], "str"),
    ("shelf", ["SHELF"], "str"),
    ("batch", ["BATCH"], "str"),
    ("batch_status", ["BATCH STATUS"], "str"),
    ("stock_on_hand", ["STOCK ON HAND", "SOH"], "int"),
    ("available_atp", ["AVAILABLE ATP", "ATP"], "int"),
    ("blocked_committed", ["BLOCKED COMMITTED", "BLOCKED/COMMITTED"], "int"),
    ("not_found", ["NOT FOUND"], "int"),
    ("cost", ["COST"], "float"),
    ("color", ["COLOR", "COLOUR"], "str"),
    ("brand", ["BRAND"], "str"),
    ("source_updated_at", ["SOURCE UPDATED AT", "UPDATED AT", "LAST UPDATED"], "date"),
    ("status", ["STATUS"], "str"),
    ("inventory_allocation", ["INVENTORY ALLOCATION"], "bit"),
    ("inventory_variance", ["INVENTORY VARIANCE"], "bit"),
    ("stock_miskeeping", ["STOCK MISKEEPING"], "bit"),
    ("image_url", ["IMAGE URL", "IMAGE"], "str"),
    ("pendency_all_channels", ["PENDENCY ALL CHANNELS", "PENDENCY"], "int"),
    ("total_inventory", ["TOTAL INVENTORY"], "int"),
]

LATEST_ZFG_HEADER_ALIASES = {
    "sku": ["SKU", "MATERIAL"],
}

SEED_SELLER_MAPPING = [
    {"seller": "LIBERTY SHOES LIMITED", "portal": "amazon", "sub_type": "MP", "vertical_head": "Naveen Satija", "kam": "Naveen Satija"},
    {"seller": "LIBERTY SHOES LIMITED", "portal": "snapdeal", "sub_type": "MP", "vertical_head": "Naveen Satija", "kam": "Naveen Satija"},
    {"seller": "LIBERTY SHOES LIMITED", "portal": "myntra", "sub_type": "MP", "vertical_head": "Naveen Satija", "kam": "Naveen Satija"},
    {"seller": "LIBERTY SHOES LIMITED", "portal": "flipkart", "sub_type": "MP", "vertical_head": "Naveen Satija", "kam": "Naveen Satija"},
    {"seller": "Cocoblu Retail", "portal": "flipkart", "sub_type": "OR", "vertical_head": "Vikas Punia", "kam": "Vikas Punia"},
    {"seller": "RetailNet", "portal": "flipkart", "sub_type": "OR", "vertical_head": "Vikas Punia", "kam": "Vikas Punia"},
    {"seller": "HSAtlastradeFashion", "portal": "myntra", "sub_type": "OR", "vertical_head": "Vikas Punia", "kam": "Vikas Punia"},
    {"seller": "XONIGHT E-Commerce", "portal": "flipkart", "sub_type": "OR", "vertical_head": "Vikas Punia", "kam": "Vikas Punia"},
    {"seller": "Truecom Retail", "portal": "flipkart", "sub_type": "OR", "vertical_head": "Vikas Punia", "kam": "Vikas Punia"},
]

# [field, sql_type, parse_kind] — parse_kind in {"str", "float", "date"}
LATEST_ZFG_FIELD_DEFS = [
    ("material", "VARCHAR(100)", "str"),
    ("sku", "VARCHAR(100)", "str"),
    ("hsn_code", "VARCHAR(50)", "str"),
    ("brand", "NVARCHAR(200)", "str"),
    ("deptt", "VARCHAR(100)", "str"),
    ("class", "VARCHAR(100)", "str"),
    ("subclass", "VARCHAR(100)", "str"),
    ("cluster", "VARCHAR(100)", "str"),
    ("artical", "VARCHAR(100)", "str"),
    ("lq", "VARCHAR(50)", "str"),
    ("color_ptn", "VARCHAR(100)", "str"),
    ("ind", "VARCHAR(50)", "str"),
    ("season", "VARCHAR(50)", "str"),
    ("mrp", "FLOAT", "float"),
    ("size", "VARCHAR(20)", "str"),
    ("size_level", "VARCHAR(50)", "str"),
    ("dist_mat", "VARCHAR(100)", "str"),
    ("sap_indicator", "VARCHAR(50)", "str"),
    ("technology", "NVARCHAR(200)", "str"),
    ("os_technology", "NVARCHAR(200)", "str"),
    ("cr_date", "DATETIME", "date"),
    ("cr_day", "VARCHAR(20)", "str"),
    ("ldate", "DATETIME", "date"),
    ("sole", "VARCHAR(100)", "str"),
    ("norm", "FLOAT", "float"),
    ("sfg_norm", "FLOAT", "float"),
    ("fg_stk_transit", "FLOAT", "float"),
    ("wip", "FLOAT", "float"),
    ("total_sale", "FLOAT", "float"),
    ("qut_qty", "FLOAT", "float"),
    ("avg_dly_sale", "FLOAT", "float"),
    ("suggest_norm", "FLOAT", "float"),
    ("pct_suggest_norm", "FLOAT", "float"),
    ("transit", "FLOAT", "float"),
    ("non_con_stk", "FLOAT", "float"),
    ("requirement", "FLOAT", "float"),
    ("bpr_pct", "FLOAT", "float"),
    ("col", "VARCHAR(50)", "str"),
    ("mto", "FLOAT", "float"),
    ("mto_fg", "FLOAT", "float"),
    ("col1", "VARCHAR(50)", "str"),
    ("tot_pipe", "FLOAT", "float"),
    ("sfg_req", "FLOAT", "float"),
    ("req_pip", "FLOAT", "float"),
    ("qut_req", "FLOAT", "float"),
    ("exc_qut_req", "FLOAT", "float"),
    ("ean_no", "VARCHAR(50)", "str"),
    ("open_so_qt", "FLOAT", "float"),
    ("other_fg_stock", "FLOAT", "float"),
    ("other_sfg_stock", "FLOAT", "float"),
    ("other_emb", "FLOAT", "float"),
    ("upper_stock", "FLOAT", "float"),
    ("sole_mat", "VARCHAR(100)", "str"),
    ("heel_typ", "VARCHAR(100)", "str"),
    ("heel_ht", "VARCHAR(50)", "str"),
    ("insole_cus", "VARCHAR(100)", "str"),
    ("midsole", "VARCHAR(100)", "str"),
    ("shoe_ht", "VARCHAR(50)", "str"),
    ("age_grp", "VARCHAR(50)", "str"),
    ("lining", "VARCHAR(100)", "str"),
    ("features_usp", "NVARCHAR(500)", "str"),
    ("shoe_type", "VARCHAR(100)", "str"),
    ("width_toe", "VARCHAR(100)", "str"),
    ("pattern_ty", "VARCHAR(100)", "str"),
    ("fastening", "VARCHAR(100)", "str"),
    ("price_str", "VARCHAR(100)", "str"),
    ("occassion", "VARCHAR(100)", "str"),
]
