"use client";

import { useMemo, useState } from "react";
import { Download, Search } from "lucide-react";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { Pager, SortableHead, useTableControls } from "@/components/operations/table-controls";
import { downloadCSV } from "@/lib/csv";
import { formatDate, formatINR, formatNumber } from "@/lib/format";
import type { InventoryRow } from "@/lib/types";

function statusTone(status: string | null): "success" | "destructive" | "muted" {
  const s = (status ?? "").toLowerCase();
  if (!s) return "muted";
  if (s.includes("inactive")) return "destructive";
  if (s.includes("active")) return "success";
  return "muted";
}

function StatusPill({ status }: { status: string | null }) {
  const tone = statusTone(status);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        tone === "success" && "bg-success/15 text-success border-success/30",
        tone === "destructive" && "bg-destructive/15 text-destructive border-destructive/30",
        tone === "muted" && "bg-muted text-muted-foreground border-border"
      )}
    >
      {status ?? "Unknown"}
    </span>
  );
}

function searchRow(row: InventoryRow, q: string): boolean {
  return (
    (row.sku_code ?? "").toLowerCase().includes(q) ||
    (row.item_name ?? "").toLowerCase().includes(q) ||
    (row.batch ?? "").toLowerCase().includes(q) ||
    (row.brand ?? "").toLowerCase().includes(q)
  );
}

function sortAccessor(row: InventoryRow, key: string): string | number | null {
  switch (key) {
    case "sku_code":
      return row.sku_code;
    case "item_name":
      return row.item_name;
    case "shelf":
      return row.shelf;
    case "batch":
      return row.batch;
    case "batch_status":
      return row.batch_status;
    case "stock_on_hand":
      return row.stock_on_hand;
    case "available_atp":
      return row.available_atp;
    case "blocked_committed":
      return row.blocked_committed;
    case "cost":
      return row.cost;
    case "color":
      return row.color;
    case "brand":
      return row.brand;
    case "status":
      return row.status;
    case "uploaded_at":
      return row.uploaded_at;
    default:
      return null;
  }
}

export function InventoryTable({ rows }: { rows: InventoryRow[] }) {
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [brandFilter, setBrandFilter] = useState("ALL");

  const statusOptions = useMemo(() => Array.from(new Set(rows.map((r) => r.status).filter(Boolean))) as string[], [rows]);
  const brandOptions = useMemo(() => Array.from(new Set(rows.map((r) => r.brand).filter(Boolean))) as string[], [rows]);

  const preFiltered = useMemo(
    () =>
      rows.filter(
        (r) => (statusFilter === "ALL" || r.status === statusFilter) && (brandFilter === "ALL" || r.brand === brandFilter)
      ),
    [rows, statusFilter, brandFilter]
  );

  const table = useTableControls(preFiltered, searchRow, sortAccessor, "sku_code", 50);

  function handleExport() {
    downloadCSV(
      "inventory.csv",
      ["SKU Code", "Item Name", "Shelf", "Batch", "Batch Status", "Stock", "ATP", "Blocked", "Cost", "Color", "Brand", "Status", "Updated"],
      table.filteredSorted.map((r) => [
        r.sku_code,
        r.item_name,
        r.shelf,
        r.batch,
        r.batch_status,
        r.stock_on_hand,
        r.available_atp,
        r.blocked_committed,
        r.cost,
        r.color,
        r.brand,
        r.status,
        r.uploaded_at,
      ])
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Inventory</CardTitle>
        <CardAction>
          <Button variant="outline" size="sm" onClick={handleExport} disabled={table.totalCount === 0}>
            <Download className="size-3.5" />
            CSV
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search SKU, item, batch, brand…"
              className="pl-8"
              value={table.search}
              onChange={(e) => table.setSearch(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All statuses</SelectItem>
              {statusOptions.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={brandFilter} onValueChange={setBrandFilter}>
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All brands</SelectItem>
              {brandOptions.map((b) => (
                <SelectItem key={b} value={b}>
                  {b}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHead label="SKU Code" sortKey="sku_code" currentKey={table.sortKey} currentDir={table.sortDir} onSort={table.toggleSort} />
              <SortableHead label="Item Name" sortKey="item_name" currentKey={table.sortKey} currentDir={table.sortDir} onSort={table.toggleSort} />
              <SortableHead label="Shelf" sortKey="shelf" currentKey={table.sortKey} currentDir={table.sortDir} onSort={table.toggleSort} />
              <SortableHead label="Batch" sortKey="batch" currentKey={table.sortKey} currentDir={table.sortDir} onSort={table.toggleSort} />
              <SortableHead
                label="Batch Status"
                sortKey="batch_status"
                currentKey={table.sortKey}
                currentDir={table.sortDir}
                onSort={table.toggleSort}
              />
              <SortableHead
                label="Stock"
                sortKey="stock_on_hand"
                currentKey={table.sortKey}
                currentDir={table.sortDir}
                onSort={table.toggleSort}
              />
              <SortableHead
                label="ATP"
                sortKey="available_atp"
                currentKey={table.sortKey}
                currentDir={table.sortDir}
                onSort={table.toggleSort}
              />
              <SortableHead
                label="Blocked"
                sortKey="blocked_committed"
                currentKey={table.sortKey}
                currentDir={table.sortDir}
                onSort={table.toggleSort}
              />
              <SortableHead label="Cost" sortKey="cost" currentKey={table.sortKey} currentDir={table.sortDir} onSort={table.toggleSort} />
              <SortableHead label="Color" sortKey="color" currentKey={table.sortKey} currentDir={table.sortDir} onSort={table.toggleSort} />
              <SortableHead label="Brand" sortKey="brand" currentKey={table.sortKey} currentDir={table.sortDir} onSort={table.toggleSort} />
              <SortableHead label="Status" sortKey="status" currentKey={table.sortKey} currentDir={table.sortDir} onSort={table.toggleSort} />
              <SortableHead
                label="Updated"
                sortKey="uploaded_at"
                currentKey={table.sortKey}
                currentDir={table.sortDir}
                onSort={table.toggleSort}
              />
            </TableRow>
          </TableHeader>
          <TableBody>
            {table.pageRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={13} className="h-24 text-center text-muted-foreground">
                  No inventory rows match your filters.
                </TableCell>
              </TableRow>
            ) : (
              table.pageRows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.sku_code}</TableCell>
                  <TableCell className="max-w-56 truncate" title={row.item_name ?? undefined}>
                    {row.item_name ?? "—"}
                  </TableCell>
                  <TableCell>{row.shelf ?? "—"}</TableCell>
                  <TableCell>{row.batch ?? "—"}</TableCell>
                  <TableCell>{row.batch_status ?? "—"}</TableCell>
                  <TableCell className="tabular-nums">{formatNumber(row.stock_on_hand)}</TableCell>
                  <TableCell className="tabular-nums">{formatNumber(row.available_atp)}</TableCell>
                  <TableCell className="tabular-nums">{formatNumber(row.blocked_committed)}</TableCell>
                  <TableCell className="tabular-nums">{formatINR(row.cost)}</TableCell>
                  <TableCell>{row.color ?? "—"}</TableCell>
                  <TableCell>{row.brand ?? "—"}</TableCell>
                  <TableCell>
                    <StatusPill status={row.status} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(row.uploaded_at)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <Pager page={table.page} pageCount={table.pageCount} totalCount={table.totalCount} pageSize={table.pageSize} onPageChange={table.setPage} />
    </Card>
  );
}
