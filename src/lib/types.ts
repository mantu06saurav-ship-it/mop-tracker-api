export type UserRole = "Super Admin" | "Manager" | "Viewer";

export interface User {
  UserId: number;
  EmployeeCode: string;
  FirstName: string;
  LastName: string | null;
  Email: string;
  PhoneNumber: string | null;
  Role: UserRole;
  Designation: string;
  Department: string | null;
  ReportingManagerId: number | null;
  ProfileImageUrl: string | null;
  IsActive: boolean;
  LastLogin: string | null;
  CreatedAt: string;
}

export type PriceStatus = "BELOW_MOP" | "AT_MOP" | "ABOVE_MOP" | "UNKNOWN";

export interface TrackerRow {
  id: number;
  batch_id: string;
  portal: string;
  code_type: string | null;
  code: string;
  sku: string | null;
  mop: number | null;
  title: string | null;
  price_scraped: number | null;
  mrp: number | null;
  rating: number | null;
  reviews: string | null;
  seller: string | null;
  product_url: string | null;
  image_url: string | null;
  inventory_status: string | null;
  scrap_status: string | null;
  price_status: PriceStatus;
  scraped_at: string;
}

export interface Summary {
  total: number;
  below_mop: number;
  at_mop: number;
  above_mop: number;
  unknown: number;
  compliance_pct: number;
}

export interface DashboardResponse {
  summary: Summary;
  rows: TrackerRow[];
}

export interface Batch {
  batch_id: string;
  total: number;
  below_mop: number;
  scraped_at: string;
}

export interface TrendPoint {
  batch_id: string;
  total: number;
  below_mop: number;
  at_mop: number;
  above_mop: number;
  unknown: number;
  scraped_at: string;
  compliance_pct: number;
}

export interface PortalBreakdown {
  portal: string;
  total: number;
  below_mop: number;
  at_mop: number;
  above_mop: number;
  unknown: number;
}

export interface ComplianceDailyRow extends TrackerRow {
  snapshot_date: string;
}

export interface Job {
  job_id: string;
  status: "QUEUED" | "RUNNING" | "DONE" | "FAILED";
  total: number;
  done: number;
  errors: number;
  inserted: number;
  db_error: string | null;
  last_error: string | null;
  percent: number;
  rows: TrackerRow[];
}

export interface SellerMappingRow {
  id: number;
  seller: string;
  portal: string;
  sub_type: string | null;
  vertical_head: string | null;
  kam: string | null;
  email_active: boolean;
  created_at: string;
  updated_at: string | null;
}

export interface EmailSettings {
  id: number;
  mode: "manual" | "auto";
  to_emails: string | null;
  cc_emails: string | null;
  send_time: string;
  enabled: boolean;
  last_sent_date: string | null;
  last_sent_at: string | null;
  updated_by: string | null;
  updated_at: string | null;
  last_delivery: string | null;
}

export interface EmailSettingsResponse {
  settings: EmailSettings;
  schedule_status: string;
  timezone: string;
}

export interface InventoryRow {
  id: number;
  inventory_type: string | null;
  sku_code: string;
  item_name: string | null;
  shelf: string | null;
  batch: string | null;
  batch_status: string | null;
  stock_on_hand: number | null;
  available_atp: number | null;
  blocked_committed: number | null;
  not_found: number | null;
  cost: number | null;
  color: string | null;
  brand: string | null;
  status: string | null;
  image_url: string | null;
  uploaded_at: string;
}

export interface InventorySummary {
  total_rows: number;
  total_skus: number;
  total_stock_on_hand: number;
  total_available_atp: number;
  total_batches: number;
  total_brands: number;
}

export interface InventoryResponse {
  rows: InventoryRow[];
  summary: InventorySummary;
}

export interface LatestZfgRow {
  id: number;
  sku: string;
  material: string | null;
  brand: string | null;
  deptt: string | null;
  class: string | null;
  subclass: string | null;
  artical: string | null;
  season: string | null;
  mrp: number | null;
  norm: number | null;
  suggest_norm: number | null;
  total_sale: number | null;
  avg_dly_sale: number | null;
  requirement: number | null;
  dist_mat: string | null;
  sap_indicator: string | null;
  size_level: string | null;
  uploaded_at: string;
}

export interface LatestZfgSummary {
  total_rows: number;
  total_skus: number;
  total_brands: number;
  total_classes: number;
  total_requirement: number;
}

export interface LatestZfgResponse {
  rows: LatestZfgRow[];
  summary: LatestZfgSummary;
}

export interface AuditFieldRow {
  field: string;
  target: string | number | null;
  actual: string | number | null;
  remark: "OK" | "NOT_OK" | "--";
  note: string;
}

export interface AuditBlock {
  sku: string;
  artical: string | null;
  brand: string | null;
  portal: string | null;
  code: string | null;
  code_type: string | null;
  dist_mat: string | null;
  sap_indicator: string | null;
  size_level: string | null;
  has_zfg: boolean;
  has_scrape: boolean;
  rows: AuditFieldRow[];
}

export interface AuditReportResponse {
  blocks: AuditBlock[];
  generated_at: string;
}

export interface PublicProduct {
  portal: string;
  title: string;
  price_scraped: number;
  mrp: number | null;
  rating: number | null;
  reviews: string | null;
  seller: string | null;
  product_url: string | null;
  image_url: string | null;
  inventory_status: string | null;
}

export interface PublicProductsResponse {
  count: number;
  page: number;
  limit: number;
  total_pages: number;
  products: PublicProduct[];
}

export const PORTALS = ["flipkart", "amazon", "myntra", "snapdeal", "ajio"] as const;
export type Portal = (typeof PORTALS)[number];
