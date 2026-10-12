"use client";

import { useMemo, useState } from "react";
import { Download, Search } from "lucide-react";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { Pager, SortableHead, useTableControls } from "@/components/operations/table-controls";
import { downloadCSV } from "@/lib/csv";
import { formatDate, formatINR, formatNumber } from "@/lib/format";
import type { LatestZfgRow } from "@/lib/types";

function searchRow(row: LatestZfgRow, q: string): boolean {
  return (
    (row.sku ?? "").toLowerCase().includes(q) ||
    (row.material ?? "").toLowerCase().includes(q) ||
    (row.brand ?? "").toLowerCase().includes(q) ||
    (row.class ?? "").toLowerCase().includes(q)
  );
}

function sortAccessor(row: LatestZfgRow, key: string): string | number | null {
  switch (key) {
    case "sku":
      return row.sku;
    case "material":
      return row.material;
    case "brand":
      return row.brand;
    case "class":
      return row.class;
    case "subclass":
      return row.subclass;
    case "artical":
      return row.artical;
    case "season":
      return row.season;
    case "mrp":
      return row.mrp;
    case "norm":
      return row.norm;
    case "suggest_norm":
      return row.suggest_norm;
    case "total_sale":
      return row.total_sale;
    case "avg_dly_sale":
      return row.avg_dly_sale;
    case "requirement":
      return row.requirement;
    case "uploaded_at":
      return row.uploaded_at;
    default:
      return null;
  }
}

export function ZfgTable({ rows }: { rows: LatestZfgRow[] }) {
  const [brandFilter, setBrandFilter] = useState("ALL");
  const [classFilter, setClassFilter] = useState("ALL");

  const brandOptions = useMemo(() => Array.from(new Set(rows.map((r) => r.brand).filter(Boolean))) as string[], [rows]);
  const classOptions = useMemo(() => Array.from(new Set(rows.map((r) => r.class).filter(Boolean))) as string[], [rows]);

  const preFiltered = useMemo(
    () => rows.filter((r) => (brandFilter === "ALL" || r.brand === brandFilter) && (classFilter === "ALL" || r.class === classFilter)),
    [rows, brandFilter, classFilter]
  );

  const table = useTableControls(preFiltered, searchRow, sortAccessor, "sku", 50);

  function handleExport() {
    downloadCSV(
      "master-data-zfg.csv",
      [
        "SKU",
        "Material",
        "Brand",
        "Class",
        "Subclass",
        "Article",
        "Season",
        "MRP",
        "Norm",
        "Suggest Norm",
        "Total Sale",
        "Avg Dly Sale",
        "Requirement",
        "Updated",
      ],
      table.filteredSorted.map((r) => [
        r.sku,
        r.material,
        r.brand,
        r.class,
        r.subclass,
        r.artical,
        r.season,
        r.mrp,
        r.norm,
        r.suggest_norm,
        r.total_sale,
        r.avg_dly_sale,
        r.requirement,
        r.uploaded_at,
      ])
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Master Data (ZFG)</CardTitle>
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
              placeholder="Search SKU, material, brand, class…"
              className="pl-8"
              value={table.search}
              onChange={(e) => table.setSearch(e.target.value)}
            />
          </div>
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
          <Select value={classFilter} onValueChange={setClassFilter}>
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All classes</SelectItem>
              {classOptions.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
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
                label="Material"
                sortKey="material"
                currentKey={table.sortKey}
                currentDir={table.sortDir}
                onSort={table.toggleSort}
              />
              <SortableHead label="Brand" sortKey="brand" currentKey={table.sortKey} currentDir={table.sortDir} onSort={table.toggleSort} />
              <SortableHead label="Class" sortKey="class" currentKey={table.sortKey} currentDir={table.sortDir} onSort={table.toggleSort} />
              <SortableHead
                label="Subclass"
                sortKey="subclass"
                currentKey={table.sortKey}
                currentDir={table.sortDir}
                onSort={table.toggleSort}
              />
              <SortableHead
                label="Article"
                sortKey="artical"
                currentKey={table.sortKey}
                currentDir={table.sortDir}
                onSort={table.toggleSort}
              />
              <SortableHead label="Season" sortKey="season" currentKey={table.sortKey} currentDir={table.sortDir} onSort={table.toggleSort} />
              <SortableHead label="MRP" sortKey="mrp" currentKey={table.sortKey} currentDir={table.sortDir} onSort={table.toggleSort} />
              <SortableHead label="Norm" sortKey="norm" currentKey={table.sortKey} currentDir={table.sortDir} onSort={table.toggleSort} />
              <SortableHead
                label="Suggest Norm"
                sortKey="suggest_norm"
                currentKey={table.sortKey}
                currentDir={table.sortDir}
                onSort={table.toggleSort}
              />
              <SortableHead
                label="Total Sale"
                sortKey="total_sale"
                currentKey={table.sortKey}
                currentDir={table.sortDir}
                onSort={table.toggleSort}
              />
              <SortableHead
                label="Avg Dly Sale"
                sortKey="avg_dly_sale"
                currentKey={table.sortKey}
                currentDir={table.sortDir}
                onSort={table.toggleSort}
              />
              <SortableHead
                label="Requirement"
                sortKey="requirement"
                currentKey={table.sortKey}
                currentDir={table.sortDir}
                onSort={table.toggleSort}
              />
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
                <TableCell colSpan={14} className="h-24 text-center text-muted-foreground">
                  No master data rows match your filters.
                </TableCell>
              </TableRow>
            ) : (
              table.pageRows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.sku}</TableCell>
                  <TableCell className="max-w-40 truncate" title={row.material ?? undefined}>
                    {row.material ?? "—"}
                  </TableCell>
                  <TableCell>{row.brand ?? "—"}</TableCell>
                  <TableCell>{row.class ?? "—"}</TableCell>
                  <TableCell>{row.subclass ?? "—"}</TableCell>
                  <TableCell>{row.artical ?? "—"}</TableCell>
                  <TableCell>{row.season ?? "—"}</TableCell>
                  <TableCell className="tabular-nums">{formatINR(row.mrp)}</TableCell>
                  <TableCell className="tabular-nums">{formatNumber(row.norm)}</TableCell>
                  <TableCell className="tabular-nums">{formatNumber(row.suggest_norm)}</TableCell>
                  <TableCell className="tabular-nums">{formatNumber(row.total_sale)}</TableCell>
                  <TableCell className="tabular-nums">{formatNumber(row.avg_dly_sale)}</TableCell>
                  <TableCell className="tabular-nums">{formatNumber(row.requirement)}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(row.uploaded_at)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <Pager page={table.page} pageCount={table.pageCount} totalCount={table.totalCount} pageSize={table.pageSize} onPageChange={table.setPage} />
      <p className="border-t px-4 py-2.5 text-xs text-muted-foreground">
        All uploaded fields are stored and available via the API; this table shows the most commonly used subset.
      </p>
    </Card>
  );
}
