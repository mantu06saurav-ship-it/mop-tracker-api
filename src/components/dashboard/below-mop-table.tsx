"use client";

import { Fragment, useMemo, useState } from "react";
import { Download, PartyPopper, Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { downloadCSV } from "@/lib/csv";
import { formatINR } from "@/lib/format";
import { PORTALS } from "@/lib/types";
import { normalizePortalKey, portalLabel, type EnrichedRow } from "@/components/dashboard/utils";
import { cn } from "@/lib/utils";

interface SkuGroup {
  key: string;
  sku: string | null;
  article: string | null;
  title: string | null;
  segment: "Online" | "Offline";
  distMat: string;
  byPortal: Map<string, EnrichedRow>;
}

function buildGroups(rows: EnrichedRow[]): SkuGroup[] {
  const map = new Map<string, SkuGroup>();
  for (const row of rows) {
    const key = row.sku || row.code;
    let group = map.get(key);
    if (!group) {
      group = { key, sku: row.sku, article: row.article, title: row.title, segment: row.segment, distMat: row.distMat, byPortal: new Map() };
      map.set(key, group);
    }
    if (!group.article && row.article) group.article = row.article;
    if (!group.title && row.title) group.title = row.title;
    const portalKey = normalizePortalKey(row.portal) ?? row.portal ?? "unknown";
    if (!group.byPortal.has(portalKey)) group.byPortal.set(portalKey, row);
  }
  return Array.from(map.values());
}

export function BelowMopTable({
  rows,
  loading,
  channelOptions,
}: {
  rows: EnrichedRow[];
  loading: boolean;
  channelOptions: string[];
}) {
  const [search, setSearch] = useState("");
  const [portalFilter, setPortalFilter] = useState("ALL");
  const [segmentFilter, setSegmentFilter] = useState("ALL");
  const [channelFilter, setChannelFilter] = useState("ALL");

  const allGroups = useMemo(() => {
    const groups = buildGroups(rows);
    return groups.filter((g) => Array.from(g.byPortal.values()).some((r) => r.price_status === "BELOW_MOP"));
  }, [rows]);

  const filteredGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allGroups.filter((g) => {
      if (q && !((g.sku ?? "").toLowerCase().includes(q) || (g.article ?? "").toLowerCase().includes(q))) return false;
      if (portalFilter !== "ALL") {
        const portalRow = g.byPortal.get(portalFilter);
        if (!portalRow || portalRow.price_status !== "BELOW_MOP") return false;
      }
      if (segmentFilter !== "ALL" && g.segment !== segmentFilter) return false;
      if (channelFilter !== "ALL" && g.distMat !== channelFilter) return false;
      return true;
    });
  }, [allGroups, search, portalFilter, segmentFilter, channelFilter]);

  function exportCsv() {
    const headers = ["SKU", "Article", "Title", "Segment", "Dist. Channel"];
    for (const p of PORTALS) headers.push(`${portalLabel(p)} MOP`, `${portalLabel(p)} Price`, `${portalLabel(p)} Seller`, `${portalLabel(p)} Link`);
    downloadCSV(
      "mop-below-mop-skus",
      headers,
      filteredGroups.map((g) => {
        const row: (string | number | null)[] = [g.sku, g.article, g.title, g.segment, g.distMat];
        for (const p of PORTALS) {
          const r = g.byPortal.get(p);
          row.push(r?.mop ?? null, r?.price_scraped ?? null, r?.seller ?? null, r?.product_url ?? null);
        }
        return row;
      })
    );
  }

  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-lg">Below-MOP SKUs</CardTitle>
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download /> Export CSV
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search SKU / Article…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-52 pl-8" />
          </div>
          <Select value={portalFilter} onValueChange={setPortalFilter}>
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
          <Select value={segmentFilter} onValueChange={setSegmentFilter}>
            <SelectTrigger size="sm" className="w-32">
              <SelectValue placeholder="Segment" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Segments</SelectItem>
              <SelectItem value="Online">Online</SelectItem>
              <SelectItem value="Offline">Offline</SelectItem>
            </SelectContent>
          </Select>
          <Select value={channelFilter} onValueChange={setChannelFilter}>
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
        </div>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        ) : allGroups.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <PartyPopper className="size-8 text-success-foreground" />
            <p className="font-medium text-success-foreground">No SKUs below MOP — every listing is compliant.</p>
          </div>
        ) : filteredGroups.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No SKUs match your filters.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 z-10 bg-background">SKU</TableHead>
                  <TableHead>Article</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Segment</TableHead>
                  <TableHead>Dist. Channel</TableHead>
                  {PORTALS.map((p) => (
                    <TableHead key={p} colSpan={4} className="border-l text-center">
                      {portalLabel(p)}
                    </TableHead>
                  ))}
                </TableRow>
                <TableRow>
                  <TableHead className="sticky left-0 z-10 bg-background" />
                  <TableHead />
                  <TableHead />
                  <TableHead />
                  <TableHead />
                  {PORTALS.map((p) => (
                    <Fragment key={p}>
                      <TableHead className="border-l text-xs">MOP</TableHead>
                      <TableHead className="text-xs">Price</TableHead>
                      <TableHead className="text-xs">Seller</TableHead>
                      <TableHead className="text-xs">Link</TableHead>
                    </Fragment>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredGroups.map((g) => (
                  <TableRow key={g.key}>
                    <TableCell className="sticky left-0 z-10 bg-background font-mono text-xs">{g.sku ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{g.article ?? "—"}</TableCell>
                    <TableCell className="max-w-48 truncate" title={g.title ?? undefined}>
                      {g.title ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={g.segment === "Online" ? "default" : "secondary"}>{g.segment}</Badge>
                    </TableCell>
                    <TableCell>{g.distMat}</TableCell>
                    {PORTALS.map((p) => {
                      const r = g.byPortal.get(p);
                      const below = r?.price_status === "BELOW_MOP";
                      return (
                        <Fragment key={`${g.key}-${p}`}>
                          <TableCell className={cn("border-l tabular-nums", !r && "text-muted-foreground")}>
                            {r ? formatINR(r.mop) : "—"}
                          </TableCell>
                          <TableCell className="tabular-nums">
                            {r ? (
                              below ? (
                                <Badge variant="destructive">{formatINR(r.price_scraped)}</Badge>
                              ) : (
                                formatINR(r.price_scraped)
                              )
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="max-w-32 truncate" title={r?.seller ?? undefined}>
                            {r?.seller ?? "—"}
                          </TableCell>
                          <TableCell>
                            {r?.product_url ? (
                              <a href={r.product_url} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-2">
                                View ↗
                              </a>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                        </Fragment>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
