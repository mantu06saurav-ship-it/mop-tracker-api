"use client";

import { useMemo, useState } from "react";
import { Download, Search } from "lucide-react";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/shared/status-badge";
import { Pager, SortableHead, useTableControls } from "@/components/operations/table-controls";
import { downloadCSV } from "@/lib/csv";
import { formatDate, formatINR } from "@/lib/format";
import { PORTALS, type PriceStatus, type TrackerRow } from "@/lib/types";

const STATUS_OPTIONS: { value: PriceStatus | "ALL"; label: string }[] = [
  { value: "ALL", label: "All statuses" },
  { value: "BELOW_MOP", label: "Below MOP" },
  { value: "AT_MOP", label: "At MOP" },
  { value: "ABOVE_MOP", label: "Above MOP" },
  { value: "UNKNOWN", label: "Unknown" },
];

function searchRow(row: TrackerRow, q: string): boolean {
  return (
    (row.title ?? "").toLowerCase().includes(q) ||
    (row.code ?? "").toLowerCase().includes(q) ||
    (row.sku ?? "").toLowerCase().includes(q) ||
    (row.seller ?? "").toLowerCase().includes(q)
  );
}

function sortAccessor(row: TrackerRow, key: string): string | number | null {
  switch (key) {
    case "sku":
      return row.sku ?? row.code;
    case "title":
      return row.title;
    case "mop":
      return row.mop;
    case "price":
      return row.price_scraped;
    case "mrp":
      return row.mrp;
    case "status":
      return row.price_status;
    case "rating":
      return row.rating;
    case "reviews":
      return row.reviews ? Number(row.reviews) || row.reviews : null;
    case "seller":
      return row.seller;
    case "scraped_at":
      return row.scraped_at;
    default:
      return null;
  }
}

export function ProductsTable({ rows }: { rows: TrackerRow[] }) {
  const [statusFilter, setStatusFilter] = useState<PriceStatus | "ALL">("ALL");
  const [portalFilter, setPortalFilter] = useState<string>("ALL");

  const preFiltered = useMemo(
    () =>
      rows.filter(
        (r) => (statusFilter === "ALL" || r.price_status === statusFilter) && (portalFilter === "ALL" || r.portal === portalFilter)
      ),
    [rows, statusFilter, portalFilter]
  );

  const table = useTableControls(preFiltered, searchRow, sortAccessor, "scraped_at", 50);

  function handleExport() {
    downloadCSV(
      "products.csv",
      ["SKU", "Code", "Title", "Portal", "MOP", "Price", "MRP", "Status", "Rating", "Reviews", "Seller", "Scraped At"],
      table.filteredSorted.map((r) => [
        r.sku,
        r.code,
        r.title,
        r.portal,
        r.mop,
        r.price_scraped,
        r.mrp,
        r.price_status,
        r.rating,
        r.reviews,
        r.seller,
        r.scraped_at,
      ])
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Products</CardTitle>
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
              placeholder="Search title, code, SKU, seller…"
              className="pl-8"
              value={table.search}
              onChange={(e) => table.setSearch(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as PriceStatus | "ALL")}>
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={portalFilter} onValueChange={setPortalFilter}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All portals</SelectItem>
              {PORTALS.map((p) => (
                <SelectItem key={p} value={p}>
                  {p[0].toUpperCase() + p.slice(1)}
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
              <SortableHead label="SKU" sortKey="sku" currentKey={table.sortKey} currentDir={table.sortDir} onSort={table.toggleSort} />
              <SortableHead
                label="Title"
                sortKey="title"
                currentKey={table.sortKey}
                currentDir={table.sortDir}
                onSort={table.toggleSort}
              />
              <SortableHead label="MOP" sortKey="mop" currentKey={table.sortKey} currentDir={table.sortDir} onSort={table.toggleSort} />
              <SortableHead
                label="Price"
                sortKey="price"
                currentKey={table.sortKey}
                currentDir={table.sortDir}
                onSort={table.toggleSort}
              />
              <SortableHead label="MRP" sortKey="mrp" currentKey={table.sortKey} currentDir={table.sortDir} onSort={table.toggleSort} />
              <SortableHead
                label="Status"
                sortKey="status"
                currentKey={table.sortKey}
                currentDir={table.sortDir}
                onSort={table.toggleSort}
              />
              <SortableHead
                label="Rating"
                sortKey="rating"
                currentKey={table.sortKey}
                currentDir={table.sortDir}
                onSort={table.toggleSort}
              />
              <SortableHead
                label="Reviews"
                sortKey="reviews"
                currentKey={table.sortKey}
                currentDir={table.sortDir}
                onSort={table.toggleSort}
              />
              <SortableHead
                label="Seller"
                sortKey="seller"
                currentKey={table.sortKey}
                currentDir={table.sortDir}
                onSort={table.toggleSort}
              />
              <SortableHead
                label="Scraped At"
                sortKey="scraped_at"
                currentKey={table.sortKey}
                currentDir={table.sortDir}
                onSort={table.toggleSort}
              />
            </TableRow>
          </TableHeader>
          <TableBody>
            {table.pageRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="h-24 text-center text-muted-foreground">
                  No products match your filters.
                </TableCell>
              </TableRow>
            ) : (
              table.pageRows.map((row) => {
                const delta = row.price_scraped !== null && row.mop !== null ? row.price_scraped - row.mop : null;
                return (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.sku ?? row.code}</TableCell>
                    <TableCell className="max-w-56 truncate" title={row.title ?? undefined}>
                      {row.title ?? "—"}
                    </TableCell>
                    <TableCell className="tabular-nums">{formatINR(row.mop)}</TableCell>
                    <TableCell className="tabular-nums">
                      <div className="flex items-center gap-1.5">
                        {formatINR(row.price_scraped)}
                        {delta !== null && delta !== 0 && (
                          <span className={delta < 0 ? "text-xs text-destructive" : "text-xs text-success-foreground"}>
                            ({delta > 0 ? "+" : ""}
                            {formatINR(delta)})
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="tabular-nums">{formatINR(row.mrp)}</TableCell>
                    <TableCell>
                      <StatusBadge status={row.price_status} />
                    </TableCell>
                    <TableCell className="tabular-nums">{row.rating ?? "—"}</TableCell>
                    <TableCell className="tabular-nums">{row.reviews ?? "—"}</TableCell>
                    <TableCell className="max-w-32 truncate">{row.seller ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(row.scraped_at)}</TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
      <Pager page={table.page} pageCount={table.pageCount} totalCount={table.totalCount} pageSize={table.pageSize} onPageChange={table.setPage} />
    </Card>
  );
}
