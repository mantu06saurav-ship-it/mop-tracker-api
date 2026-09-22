import type { AuditBlock } from "@/lib/types";

export function blockNotOkCount(block: AuditBlock): number {
  return block.rows.filter((row) => row.remark === "NOT_OK").length;
}

export function blockHasNotOk(block: AuditBlock): boolean {
  return block.rows.some((row) => row.remark === "NOT_OK");
}

export interface AuditKpis {
  totalBlocks: number;
  notOkFields: number;
  skusFullyOk: number;
  missingZfg: number;
  skusAudited: number;
}

export function computeKpis(blocks: AuditBlock[]): AuditKpis {
  let notOkFields = 0;
  let missingZfg = 0;
  const bySku = new Map<string, AuditBlock[]>();

  for (const block of blocks) {
    notOkFields += blockNotOkCount(block);
    if (!block.has_zfg) missingZfg += 1;
    const list = bySku.get(block.sku);
    if (list) list.push(block);
    else bySku.set(block.sku, [block]);
  }

  let skusFullyOk = 0;
  for (const list of bySku.values()) {
    if (list.every((block) => !blockHasNotOk(block))) skusFullyOk += 1;
  }

  return {
    totalBlocks: blocks.length,
    notOkFields,
    skusFullyOk,
    missingZfg,
    skusAudited: bySku.size,
  };
}

export interface PortalSummaryRow {
  portal: string;
  audited: number;
  fails: number;
  pass: number;
  passPct: number;
}

export function computePortalSummary(blocks: AuditBlock[]): PortalSummaryRow[] {
  const map = new Map<string, { audited: number; fails: number }>();
  for (const block of blocks) {
    const portal = block.portal ?? "Unknown";
    const entry = map.get(portal) ?? { audited: 0, fails: 0 };
    entry.audited += 1;
    if (blockHasNotOk(block)) entry.fails += 1;
    map.set(portal, entry);
  }

  const rows = Array.from(map.entries()).map(([portal, { audited, fails }]) => {
    const pass = audited - fails;
    return {
      portal,
      audited,
      fails,
      pass,
      passPct: audited > 0 ? Math.round((pass / audited) * 100) : 0,
    };
  });

  rows.sort((a, b) => b.audited - a.audited);
  return rows;
}

export interface FieldBreakdownRow {
  field: string;
  fails: number;
  failPct: number;
}

export function computeFieldBreakdown(blocks: AuditBlock[]): FieldBreakdownRow[] {
  const totalBlocks = blocks.length;
  const map = new Map<string, number>();
  for (const block of blocks) {
    for (const row of block.rows) {
      if (!map.has(row.field)) map.set(row.field, 0);
      if (row.remark === "NOT_OK") map.set(row.field, (map.get(row.field) ?? 0) + 1);
    }
  }

  const rows = Array.from(map.entries()).map(([field, fails]) => ({
    field,
    fails,
    failPct: totalBlocks > 0 ? Math.round((fails / totalBlocks) * 100) : 0,
  }));

  rows.sort((a, b) => b.fails - a.fails);
  return rows;
}

export interface TopProblemSkuRow {
  sku: string;
  artical: string | null;
  portals: string;
  fails: number;
}

export function computeTopProblemSkus(blocks: AuditBlock[]): TopProblemSkuRow[] {
  const map = new Map<string, { artical: string | null; portals: Set<string>; fails: number }>();
  for (const block of blocks) {
    const fails = blockNotOkCount(block);
    if (fails === 0) continue;
    const entry = map.get(block.sku) ?? { artical: block.artical, portals: new Set<string>(), fails: 0 };
    entry.fails += fails;
    if (block.portal) entry.portals.add(block.portal);
    if (!entry.artical && block.artical) entry.artical = block.artical;
    map.set(block.sku, entry);
  }

  const rows = Array.from(map.entries()).map(([sku, { artical, portals, fails }]) => ({
    sku,
    artical,
    portals: Array.from(portals).join(", "),
    fails,
  }));

  rows.sort((a, b) => b.fails - a.fails);
  return rows.slice(0, 10);
}

export function distinctValues(
  blocks: AuditBlock[],
  key: "portal" | "sap_indicator" | "dist_mat" | "size_level"
): string[] {
  const set = new Set<string>();
  for (const block of blocks) {
    const value = block[key];
    if (value) set.add(value);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}
