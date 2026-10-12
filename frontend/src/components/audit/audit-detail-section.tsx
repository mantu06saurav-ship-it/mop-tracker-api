"use client";

import { useMemo, useState } from "react";
import { Download, Search, Table2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardAction } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { downloadCSV } from "@/lib/csv";
import { blockHasNotOk, distinctValues } from "@/components/audit/audit-utils";
import { RemarkBadge } from "@/components/audit/remark-badge";
import type { AuditBlock } from "@/lib/types";

const PAGE_SIZE = 50;
const ALL = "__all__";

export function AuditDetailSection({ blocks, loading }: { blocks: AuditBlock[]; loading: boolean }) {
  const [search, setSearch] = useState("");
  const [portal, setPortal] = useState(ALL);
  const [sapIndicator, setSapIndicator] = useState(ALL);
  const [distMat, setDistMat] = useState(ALL);
  const [sizeLevel, setSizeLevel] = useState(ALL);
  const [onlyNotOk, setOnlyNotOk] = useState(false);
  const [page, setPage] = useState(1);

  const portalOptions = useMemo(() => distinctValues(blocks, "portal"), [blocks]);
  const sapOptions = useMemo(() => distinctValues(blocks, "sap_indicator"), [blocks]);
  const distMatOptions = useMemo(() => distinctValues(blocks, "dist_mat"), [blocks]);
  const sizeLevelOptions = useMemo(() => distinctValues(blocks, "size_level"), [blocks]);

  const filteredBlocks = useMemo(() => {
    const q = search.trim().toLowerCase();
    return blocks.filter((block) => {
      if (portal !== ALL && (block.portal ?? "") !== portal) return false;
      if (sapIndicator !== ALL && (block.sap_indicator ?? "") !== sapIndicator) return false;
      if (distMat !== ALL && (block.dist_mat ?? "") !== distMat) return false;
      if (sizeLevel !== ALL && (block.size_level ?? "") !== sizeLevel) return false;
      if (onlyNotOk && !blockHasNotOk(block)) return false;
      if (q) {
        const haystack = `${block.sku} ${block.artical ?? ""} ${block.code ?? ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [blocks, search, portal, sapIndicator, distMat, sizeLevel, onlyNotOk]);

  const totalPages = Math.max(1, Math.ceil(filteredBlocks.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageBlocks = filteredBlocks.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  function resetToFirstPage() {
    setPage(1);
  }

  function exportCsv() {
    const rows: (string | number | null)[][] = [];
    for (const block of filteredBlocks) {
      for (const row of block.rows) {
        rows.push([
          block.sku,
          block.artical,
          block.brand,
          block.portal,
          block.code_type,
          block.code,
          block.dist_mat,
          block.sap_indicator,
          block.size_level,
          row.field,
          row.target,
          row.actual,
          row.remark,
          row.note,
        ]);
      }
    }
    downloadCSV(
      "audit-report-detail.csv",
      [
        "SKU",
        "Article",
        "Brand",
        "Portal",
        "Code Type",
        "Code",
        "Dist_Mat",
        "SAP Indicator",
        "Size Level",
        "Field",
        "Target",
        "Actual",
        "Remark",
        "Note",
      ],
      rows
    );
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Table2 className="size-4 text-muted-foreground" />
          Audit Detail
        </CardTitle>
        <CardAction>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={loading || filteredBlocks.length === 0}>
            <Download className="size-3.5" data-icon="inline-start" />
            CSV
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-48 flex-1">
            <Label htmlFor="audit-search" className="mb-1.5 text-xs text-muted-foreground">
              Search
            </Label>
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="audit-search"
                placeholder="SKU, article or code…"
                className="pl-8"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  resetToFirstPage();
                }}
              />
            </div>
          </div>

          <FilterSelect
            label="Portal"
            value={portal}
            options={portalOptions}
            onChange={(v) => {
              setPortal(v);
              resetToFirstPage();
            }}
          />
          <FilterSelect
            label="SAP Indicator"
            value={sapIndicator}
            options={sapOptions}
            onChange={(v) => {
              setSapIndicator(v);
              resetToFirstPage();
            }}
          />
          <FilterSelect
            label="Dist_Mat"
            value={distMat}
            options={distMatOptions}
            onChange={(v) => {
              setDistMat(v);
              resetToFirstPage();
            }}
          />
          <FilterSelect
            label="Size Level"
            value={sizeLevel}
            options={sizeLevelOptions}
            onChange={(v) => {
              setSizeLevel(v);
              resetToFirstPage();
            }}
          />

          <div className="flex items-center gap-2 pb-1.5">
            <Checkbox
              id="only-not-ok"
              checked={onlyNotOk}
              onCheckedChange={(checked) => {
                setOnlyNotOk(checked === true);
                resetToFirstPage();
              }}
            />
            <Label htmlFor="only-not-ok" className="text-sm font-normal">
              Show only Not OK
            </Label>
          </div>
        </div>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        ) : filteredBlocks.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No blocks match the current filters.</p>
        ) : (
          <>
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead>Article</TableHead>
                    <TableHead>Portal</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Field</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead>Actual</TableHead>
                    <TableHead>Remark</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageBlocks.map((block, blockIdx) => {
                    const blockKey = `${block.sku}-${block.portal}-${block.code}-${blockIdx}`;
                    return block.rows.map((row, rowIdx) => (
                      <TableRow key={`${blockKey}-${rowIdx}`}>
                        {rowIdx === 0 && (
                          <>
                            <TableCell rowSpan={block.rows.length} className="align-top font-medium">
                              {block.sku}
                            </TableCell>
                            <TableCell rowSpan={block.rows.length} className="align-top whitespace-normal">
                              {block.artical ?? "—"}
                            </TableCell>
                            <TableCell rowSpan={block.rows.length} className="align-top capitalize">
                              {block.portal ?? "—"}
                            </TableCell>
                            <TableCell rowSpan={block.rows.length} className="align-top">
                              {block.code ?? "—"}
                            </TableCell>
                          </>
                        )}
                        <TableCell>{row.field}</TableCell>
                        <TableCell className="whitespace-normal">{row.target ?? "—"}</TableCell>
                        <TableCell className="whitespace-normal">
                          <div>{row.actual ?? "—"}</div>
                          {row.note && <div className="text-xs text-muted-foreground">{row.note}</div>}
                        </TableCell>
                        <TableCell>
                          <RemarkBadge remark={row.remark} />
                        </TableCell>
                      </TableRow>
                    ));
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="flex flex-col items-center justify-between gap-2 sm:flex-row">
              <p className="text-xs text-muted-foreground">
                Showing {pageBlocks.length} of {filteredBlocks.length} blocks — page {currentPage} of {totalPages}
              </p>
              {totalPages > 1 && (
                <Pagination className="mx-0 w-auto justify-end">
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          setPage((p) => Math.max(1, p - 1));
                        }}
                        className={currentPage <= 1 ? "pointer-events-none opacity-50" : undefined}
                      />
                    </PaginationItem>
                    <PaginationItem>
                      <PaginationLink href="#" isActive className="pointer-events-none">
                        {currentPage} / {totalPages}
                      </PaginationLink>
                    </PaginationItem>
                    <PaginationItem>
                      <PaginationNext
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          setPage((p) => Math.min(totalPages, p + 1));
                        }}
                        className={currentPage >= totalPages ? "pointer-events-none opacity-50" : undefined}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <Label className="mb-1.5 text-xs text-muted-foreground">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-36">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All</SelectItem>
          {options.map((option) => (
            <SelectItem key={option} value={option} className="capitalize">
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
