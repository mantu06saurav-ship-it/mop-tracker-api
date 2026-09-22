/**
 * Shared client-side helpers for the MOP Dashboard page: joining tracker rows against latest-ZFG
 * data (SKU -> article / distribution channel), and small aggregate helpers reused by the
 * compliance matrix, penalty report and below-MOP pivot table.
 */
import type { LatestZfgRow, PriceStatus, TrackerRow } from "@/lib/types";
import { baseSkuFromZfg, deriveSegment } from "@/lib/penalty";
import { computeVertical } from "@/lib/format";
import { PORTALS } from "@/lib/types";

export interface EnrichedRow extends TrackerRow {
  vertical: "MP" | "OR";
  distMat: string;
  article: string | null;
  segment: "Online" | "Offline";
}

/** Index latest-ZFG rows by the bare 10-char SKU so tracker rows (sku_code) can be joined to them. */
export function buildZfgIndex(zfgRows: LatestZfgRow[] | undefined): Map<string, LatestZfgRow> {
  const map = new Map<string, LatestZfgRow>();
  for (const z of zfgRows ?? []) {
    const base = baseSkuFromZfg(z.sku);
    if (base && !map.has(base)) map.set(base, z);
  }
  return map;
}

export function enrichRows<T extends TrackerRow>(rows: T[] | undefined, zfgIndex: Map<string, LatestZfgRow>): (T & EnrichedRow)[] {
  return (rows ?? []).map((row) => {
    const zfg = row.sku ? zfgIndex.get(row.sku) : undefined;
    return {
      ...row,
      vertical: computeVertical(row.seller),
      distMat: zfg?.dist_mat?.trim() || "Unknown",
      article: zfg?.artical ?? null,
      segment: deriveSegment(zfg?.dist_mat),
    };
  });
}

/** Result of enriching a ComplianceDailyRow — carries `snapshot_date` through. */
export type EnrichedDailyRow = EnrichedRow & { snapshot_date: string };

export function isBreached(row: TrackerRow, tolerance = 15): boolean {
  if (row.mop == null || row.price_scraped == null) return false;
  return row.mop - row.price_scraped > tolerance;
}

export const PORTAL_LABELS: Record<string, string> = {
  flipkart: "Flipkart",
  amazon: "Amazon",
  myntra: "Myntra",
  snapdeal: "Snapdeal",
  ajio: "Ajio",
};

export function portalLabel(portal: string | null | undefined): string {
  const key = (portal ?? "").toLowerCase().trim();
  return PORTAL_LABELS[key] ?? (portal || "Unknown");
}

/** Matches a raw row.portal string to one of the 5 canonical PORTALS keys, if possible. */
export function normalizePortalKey(portal: string | null | undefined): string | null {
  const p = (portal ?? "").toLowerCase();
  return PORTALS.find((key) => p.includes(key)) ?? null;
}

export interface GroupMetrics {
  key: string;
  rows: EnrichedRow[];
  totalSku: number;
  breachedArticles: number;
  atMop: number;
  aboveMop: number;
  belowMop: number;
  compliancePct: number;
}

export function computeGroupMetrics(key: string, rows: EnrichedRow[], tolerance = 15): GroupMetrics {
  const totalSku = new Set(rows.map((r) => r.sku || r.code)).size;
  const breachedArticles = new Set(
    rows.filter((r) => isBreached(r, tolerance)).map((r) => r.article).filter((a): a is string => !!a)
  ).size;
  const atMop = rows.filter((r) => r.price_status === "AT_MOP").length;
  const aboveMop = rows.filter((r) => r.price_status === "ABOVE_MOP").length;
  const belowMop = rows.filter((r) => r.price_status === "BELOW_MOP").length;
  const compliancePct = rows.length ? Math.round(((atMop + aboveMop) / rows.length) * 100) : 0;
  return { key, rows, totalSku, breachedArticles, atMop, aboveMop, belowMop, compliancePct };
}

export function statusLabel(status: PriceStatus | string | null | undefined): string {
  return status ?? "UNKNOWN";
}
