"use client";

import { useMemo, useState } from "react";
import { ChevronRight, Download, Search, Undo2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/shared/status-badge";
import { downloadCSV } from "@/lib/csv";
import { formatDate, formatINR } from "@/lib/format";
import { PORTALS } from "@/lib/types";
import {
  type EnrichedDailyRow,
  type EnrichedRow,
  type GroupMetrics,
  computeGroupMetrics,
  normalizePortalKey,
  portalLabel,
} from "@/components/dashboard/utils";

type Level = "vertical" | "portal" | "channel";

export interface ComplianceFilters {
  vertical: "ALL" | "MP" | "OR";
  portal: string;
  channel: string;
}

export function ComplianceMatrix({
  overallRows,
  dailyRows,
  loadingOverall,
  loadingDaily,
  channelOptions,
  filters,
  onFiltersChange,
  onLeafDialogOpenChange,
}: {
  overallRows: EnrichedRow[];
  dailyRows: EnrichedDailyRow[];
  loadingOverall: boolean;
  loadingDaily: boolean;
  channelOptions: string[];
  filters: ComplianceFilters;
  onFiltersChange: (filters: ComplianceFilters) => void;
  onLeafDialogOpenChange: (open: boolean) => void;
}) {
  const [basis, setBasis] = useState<"overall" | "daily">("overall");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [leafGroup, setLeafGroup] = useState<GroupMetrics | null>(null);
  const [leafOpen, setLeafOpen] = useState(false);
  const [leafSearch, setLeafSearch] = useState("");

  const { vertical, portal, channel } = filters;

  const availableDates = useMemo(() => {
    const set = new Set(dailyRows.map((r) => r.snapshot_date).filter(Boolean));
    return Array.from(set).sort((a, b) => (a < b ? 1 : -1));
  }, [dailyRows]);

  const activeDate = selectedDate ?? availableDates[0] ?? null;

  const baseRows = useMemo(() => {
    if (basis === "overall") return overallRows;
    if (!activeDate) return [];
    return dailyRows.filter((r) => r.snapshot_date === activeDate);
  }, [basis, overallRows, dailyRows, activeDate]);

  const filteredRows = useMemo(
    () =>
      baseRows.filter(
        (r) =>
          (vertical === "ALL" || r.vertical === vertical) &&
          (portal === "ALL" || normalizePortalKey(r.portal) === portal) &&
          (channel === "ALL" || r.distMat === channel)
      ),
    [baseRows, vertical, portal, channel]
  );

  const level: Level = vertical === "ALL" ? "vertical" : portal === "ALL" ? "portal" : "channel";

  const groups: GroupMetrics[] = useMemo(() => {
    if (level === "vertical") {
      return (["MP", "OR"] as const).map((v) => computeGroupMetrics(v, filteredRows.filter((r) => r.vertical === v)));
    }
    if (level === "portal") {
      const present = new Set(filteredRows.map((r) => normalizePortalKey(r.portal) ?? (r.portal || "unknown")));
      const ordered = [...PORTALS.filter((p) => present.has(p)), ...Array.from(present).filter((p) => !(PORTALS as readonly string[]).includes(p))];
      return ordered.map((p) => computeGroupMetrics(p, filteredRows.filter((r) => (normalizePortalKey(r.portal) ?? r.portal) === p)));
    }
    const present = Array.from(new Set(filteredRows.map((r) => r.distMat || "Unknown"))).sort();
    return present.map((c) => computeGroupMetrics(c, filteredRows.filter((r) => (r.distMat || "Unknown") === c)));
  }, [level, filteredRows]);

  const loading = basis === "overall" ? loadingOverall : loadingDaily;

  function groupLabel(g: GroupMetrics): string {
    if (level === "vertical") return g.key === "MP" ? "MP — Liberty Official" : "OR — Other Resellers";
    if (level === "portal") return portalLabel(g.key);
    return g.key;
  }

  function handleRowClick(g: GroupMetrics) {
    if (level === "vertical") {
      onFiltersChange({ vertical: g.key as "MP" | "OR", portal: "ALL", channel: "ALL" });
    } else if (level === "portal") {
      onFiltersChange({ ...filters, portal: g.key, channel: "ALL" });
    } else {
      setLeafGroup(g);
      setLeafSearch("");
      setLeafOpen(true);
      onLeafDialogOpenChange(true);
    }
  }

  function drillUp() {
    if (channel !== "ALL") onFiltersChange({ ...filters, channel: "ALL" });
    else if (portal !== "ALL") onFiltersChange({ ...filters, portal: "ALL", channel: "ALL" });
    else if (vertical !== "ALL") onFiltersChange({ vertical: "ALL", portal: "ALL", channel: "ALL" });
  }

  function exportMatrix() {
    const dimLabel = level === "vertical" ? "Vertical" : level === "portal" ? "Portal" : "Distribution Channel";
    downloadCSV(
      "mop-compliance-matrix",
      [dimLabel, "Total MOP Breached Article", "Total SKU", "At MOP", "Above MOP", "Compliance %"],
      groups.map((g) => [groupLabel(g), g.breachedArticles, g.totalSku, g.atMop, g.aboveMop, g.compliancePct])
    );
  }

  function closeLeaf(open: boolean) {
    setLeafOpen(open);
    onLeafDialogOpenChange(open);
  }

  const leafRows = useMemo(() => {
    if (!leafGroup) return [];
    const q = leafSearch.trim().toLowerCase();
    if (!q) return leafGroup.rows;
    return leafGroup.rows.filter(
      (r) => (r.sku ?? "").toLowerCase().includes(q) || (r.article ?? "").toLowerCase().includes(q) || (r.title ?? "").toLowerCase().includes(q)
    );
  }, [leafGroup, leafSearch]);

  function exportLeaf() {
    if (!leafGroup) return;
    downloadCSV(
      `mop-leaf-${leafGroup.key}`,
      ["SKU", "Article", "Title", "Portal", "Vertical", "Channel", "MOP", "Scraped Price", "Status", "Seller", "Link"],
      leafRows.map((r) => [
        r.sku,
        r.article,
        r.title,
        portalLabel(r.portal),
        r.vertical,
        r.distMat,
        r.mop,
        r.price_scraped,
        r.price_status,
        r.seller,
        r.product_url,
      ])
    );
  }

  const canDrillUp = vertical !== "ALL" || portal !== "ALL" || channel !== "ALL";

  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="text-lg">Compliance Matrix</CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">
              MP = Liberty&apos;s own official listings · OR = other resellers. Click a row to drill in; use the
              breadcrumb or Drill Up to step back out. Channel rows open a SKU-level detail view.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Tabs value={basis} onValueChange={(v) => setBasis(v as "overall" | "daily")}>
              <TabsList>
                <TabsTrigger value="overall">Overall</TabsTrigger>
                <TabsTrigger value="daily">Daily</TabsTrigger>
              </TabsList>
            </Tabs>
            {basis === "daily" && (
              <Select value={activeDate ?? undefined} onValueChange={setSelectedDate}>
                <SelectTrigger size="sm" className="w-36">
                  <SelectValue placeholder="Pick a date" />
                </SelectTrigger>
                <SelectContent>
                  {availableDates.map((d) => (
                    <SelectItem key={d} value={d}>
                      {formatDate(d, { withTime: false })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select value={vertical} onValueChange={(v) => onFiltersChange({ vertical: v as "ALL" | "MP" | "OR", portal: "ALL", channel: "ALL" })}>
            <SelectTrigger size="sm" className="w-32">
              <SelectValue placeholder="Vertical" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Verticals</SelectItem>
              <SelectItem value="MP">MP</SelectItem>
              <SelectItem value="OR">OR</SelectItem>
            </SelectContent>
          </Select>

          <Select value={portal} onValueChange={(v) => onFiltersChange({ ...filters, portal: v, channel: "ALL" })}>
            <SelectTrigger size="sm" className="w-36">
              <SelectValue placeholder="Portal" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Portals</SelectItem>
              {PORTALS.map((p) => (
                <SelectItem key={p} value={p}>
                  {portalLabel(p)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={channel} onValueChange={(v) => onFiltersChange({ ...filters, channel: v })}>
            <SelectTrigger size="sm" className="w-44">
              <SelectValue placeholder="Distribution Channel" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Channels</SelectItem>
              {channelOptions.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="outline" size="sm" onClick={drillUp} disabled={!canDrillUp}>
            <Undo2 /> Drill Up
          </Button>

          <Button variant="outline" size="sm" className="ml-auto" onClick={exportMatrix}>
            <Download /> Export CSV
          </Button>
        </div>

        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              {vertical === "ALL" ? (
                <BreadcrumbPage>All Verticals</BreadcrumbPage>
              ) : (
                <BreadcrumbLink className="cursor-pointer" onClick={() => onFiltersChange({ vertical: "ALL", portal: "ALL", channel: "ALL" })}>
                  All Verticals
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
            {vertical !== "ALL" && (
              <>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  {portal === "ALL" ? (
                    <BreadcrumbPage>{vertical}</BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink className="cursor-pointer" onClick={() => onFiltersChange({ ...filters, portal: "ALL", channel: "ALL" })}>
                      {vertical}
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
              </>
            )}
            {portal !== "ALL" && (
              <>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  {channel === "ALL" ? (
                    <BreadcrumbPage>{portalLabel(portal)}</BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink className="cursor-pointer" onClick={() => onFiltersChange({ ...filters, channel: "ALL" })}>
                      {portalLabel(portal)}
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
              </>
            )}
            {channel !== "ALL" && (
              <>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>{channel}</BreadcrumbPage>
                </BreadcrumbItem>
              </>
            )}
          </BreadcrumbList>
        </Breadcrumb>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        ) : groups.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No rows match the current filters.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{level === "vertical" ? "Vertical" : level === "portal" ? "Portal" : "Distribution Channel"}</TableHead>
                  <TableHead>Total MOP Breached Article</TableHead>
                  <TableHead>Total SKU</TableHead>
                  <TableHead>At MOP</TableHead>
                  <TableHead>Above MOP</TableHead>
                  <TableHead>Compliance %</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groups.map((g) => (
                  <TableRow key={g.key} className="cursor-pointer" onClick={() => handleRowClick(g)}>
                    <TableCell className="font-medium">{groupLabel(g)}</TableCell>
                    <TableCell>
                      {g.breachedArticles > 0 ? (
                        <Badge variant="destructive">{g.breachedArticles}</Badge>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell className="tabular-nums">{g.totalSku}</TableCell>
                    <TableCell className="tabular-nums">{g.atMop}</TableCell>
                    <TableCell className="tabular-nums">{g.aboveMop}</TableCell>
                    <TableCell className="tabular-nums">{g.compliancePct}%</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleRowClick(g); }}>
                        {level === "channel" ? "View Detail 🔍" : (
                          <>
                            Drill Down <ChevronRight className="size-3.5" />
                          </>
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <Dialog open={leafOpen} onOpenChange={closeLeaf}>
        <DialogContent className="max-w-[95vw] sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>{leafGroup ? groupLabel(leafGroup) : ""} — SKU Detail</DialogTitle>
            <DialogDescription>
              {leafGroup ? `${leafGroup.rows.length} row(s) · ${leafGroup.breachedArticles} breached article(s)` : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search SKU / Article / Title…"
                value={leafSearch}
                onChange={(e) => setLeafSearch(e.target.value)}
                className="pl-8"
              />
            </div>
            <Button variant="outline" size="sm" onClick={exportLeaf}>
              <Download /> Export CSV
            </Button>
          </div>

          <div className="max-h-[60vh] overflow-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Article</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Portal</TableHead>
                  <TableHead>Vertical</TableHead>
                  <TableHead>Channel</TableHead>
                  <TableHead>MOP</TableHead>
                  <TableHead>Scraped Price</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Seller</TableHead>
                  <TableHead>Link</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leafRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="py-8 text-center text-muted-foreground">
                      No rows match your search.
                    </TableCell>
                  </TableRow>
                ) : (
                  leafRows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs">{r.sku}</TableCell>
                      <TableCell className="font-mono text-xs">{r.article ?? "—"}</TableCell>
                      <TableCell className="max-w-56 truncate" title={r.title ?? undefined}>
                        {r.title ?? "—"}
                      </TableCell>
                      <TableCell>{portalLabel(r.portal)}</TableCell>
                      <TableCell>{r.vertical}</TableCell>
                      <TableCell>{r.distMat}</TableCell>
                      <TableCell className="tabular-nums">{formatINR(r.mop)}</TableCell>
                      <TableCell className="tabular-nums">{formatINR(r.price_scraped)}</TableCell>
                      <TableCell>
                        <StatusBadge status={r.price_status} />
                      </TableCell>
                      <TableCell className="max-w-40 truncate" title={r.seller ?? undefined}>
                        {r.seller ?? "—"}
                      </TableCell>
                      <TableCell>
                        {r.product_url ? (
                          <a href={r.product_url} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-2">
                            View ↗
                          </a>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
