/**
 * Client-side "MOP Breached Summary" penalty math — this table has live-adjustable Gap
 * Tolerance / VH Rate / KAM Rate inputs that recompute instantly on every keystroke, so (unlike
 * the fixed-constant version baked into the backend's daily email snapshot) it has to run here,
 * fed by raw tracker rows + seller mapping rather than a fixed backend endpoint.
 */

import type { SellerMappingRow, TrackerRow } from "@/lib/types";
import { computeVertical } from "@/lib/format";

export const PENALTY_PORTAL_LABELS: Record<string, string> = {
  flipkart: "Flipkart",
  myntra: "Myntra",
  amazon: "Amazon",
  snapdeal: "Snapdeal",
  ajio: "Ajio",
};
const PORTAL_KEYS = Object.keys(PENALTY_PORTAL_LABELS);

export const PENALTY_DEFAULTS = { tolerance: 15, vhRate: 250, kamRate: 250 };

export function normalizeSellerKey(seller: string | null | undefined): string {
  return (seller ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function matchPenaltyPortalKey(portal: string | null | undefined): string | null {
  const p = (portal ?? "").toLowerCase();
  return PORTAL_KEYS.find((key) => p.includes(key)) ?? null;
}

export function findSellerMapping(
  mappingRows: SellerMappingRow[],
  seller: string | null | undefined,
  portalKey: string | null
): SellerMappingRow | null {
  if (!portalKey) return null;
  const vertical = computeVertical(seller);
  if (vertical === "MP") {
    return mappingRows.find((m) => m.portal.toLowerCase() === portalKey && (m.sub_type ?? "").toUpperCase() === "MP") ?? null;
  }
  const key = normalizeSellerKey(seller);
  return mappingRows.find((m) => m.portal.toLowerCase() === portalKey && normalizeSellerKey(m.seller) === key) ?? null;
}

export interface PenaltyRow {
  portalLabel: string;
  verticalHead: string;
  kam: string;
  seller: string;
  mopValue: number;
  portalValue: number;
  variance: number;
  variancePct: number;
  breachedCount: number;
  penaltyRate: number;
  penaltyAmount: number;
  vhPenaltyAmount: number;
  kamPenaltyAmount: number;
}

/** `belowRows` must already be filtered to price_status === "BELOW_MOP"; attach `.article`
 * (SKU→artical, zero-padded-15 joined) beforehand if you want distinct-article breach counting —
 * otherwise breach count falls back to raw breaching row count. */
export function buildPenaltyReportRows(
  belowRows: (TrackerRow & { article?: string | null })[],
  mappingRows: SellerMappingRow[],
  opts: { tolerance: number; vhRate: number; kamRate: number } = PENALTY_DEFAULTS
): PenaltyRow[] {
  interface Group {
    portalKey: string | null;
    seller: string;
    mopSum: number;
    portalSum: number;
    breachArticles: Set<string>;
    breachRowCount: number;
  }
  const groups = new Map<string, Group>();

  for (const row of belowRows) {
    const portalKey = matchPenaltyPortalKey(row.portal);
    const seller = row.seller || "Unknown Seller";
    const key = `${portalKey ?? "?"}::${seller}`;
    let group = groups.get(key);
    if (!group) {
      group = { portalKey, seller, mopSum: 0, portalSum: 0, breachArticles: new Set(), breachRowCount: 0 };
      groups.set(key, group);
    }
    const mop = row.mop ?? 0;
    const price = row.price_scraped ?? 0;
    group.mopSum += mop;
    group.portalSum += price;

    const shortfall = mop - price;
    if (shortfall > opts.tolerance) {
      if (row.article) group.breachArticles.add(row.article);
      else group.breachRowCount += 1;
    }
  }

  const rows: PenaltyRow[] = [];
  for (const group of groups.values()) {
    const mapping = findSellerMapping(mappingRows, group.seller, group.portalKey);
    const mopValue = Math.round(group.mopSum);
    const portalValue = Math.round(group.portalSum);
    const variance = portalValue - mopValue;
    const variancePct = mopValue ? Math.round((variance / mopValue) * 100) : 0;
    const breachedCount = group.breachArticles.size || group.breachRowCount;
    const rate = opts.vhRate + opts.kamRate;

    rows.push({
      portalLabel: group.portalKey ? PENALTY_PORTAL_LABELS[group.portalKey] : "Unknown",
      verticalHead: mapping?.vertical_head || "Unmapped",
      kam: mapping?.kam || "—",
      seller: group.seller,
      mopValue,
      portalValue,
      variance,
      variancePct,
      breachedCount,
      penaltyRate: rate,
      penaltyAmount: breachedCount * rate,
      vhPenaltyAmount: breachedCount * opts.vhRate,
      kamPenaltyAmount: breachedCount * opts.kamRate,
    });
  }

  rows.sort((a, b) => a.verticalHead.localeCompare(b.verticalHead) || a.kam.localeCompare(b.kam) || a.seller.localeCompare(b.seller));
  return rows;
}

/** latest_zfg.sku is zero-padded to 15 chars; mop_data/tracker sku_code is the bare 10-digit
 * code — join on the last 10 characters. */
export function baseSkuFromZfg(sku: string | null | undefined): string {
  return (sku ?? "").slice(-10);
}

export function deriveSegment(distMat: string | null | undefined): "Online" | "Offline" {
  return (distMat ?? "").toLowerCase().includes("e-comm") ? "Online" : "Offline";
}
