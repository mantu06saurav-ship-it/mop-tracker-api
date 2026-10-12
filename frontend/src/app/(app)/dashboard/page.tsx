"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Activity, ArrowDownRight, ArrowUpRight, CalendarRange, CircleAlert } from "lucide-react";
import { RequireAuth } from "@/components/shared/require-auth";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useComplianceDaily, useDashboard, usePortalBreakdown, useTrends } from "@/lib/hooks/use-dashboard";
import { useSellerMapping } from "@/lib/hooks/use-seller-mapping";
import { useLatestZfgData } from "@/lib/hooks/use-zfg";
import { formatDate } from "@/lib/format";
import { AlertBanner } from "@/components/dashboard/alert-banner";
import { KpiCards } from "@/components/dashboard/kpi-cards";
import { VerticalCards } from "@/components/dashboard/vertical-cards";
import { ComplianceMatrix, type ComplianceFilters } from "@/components/dashboard/compliance-matrix";
import { PenaltyReport } from "@/components/dashboard/penalty-report";
import { SellerMappingDialog } from "@/components/dashboard/seller-mapping-dialog";
import { BelowMopTable } from "@/components/dashboard/below-mop-table";
import { TrendCharts } from "@/components/dashboard/trend-charts";
import { buildZfgIndex, enrichRows, portalLabel, type EnrichedDailyRow } from "@/components/dashboard/utils";

const REFRESH_INTERVAL_MS = 3 * 60 * 1000;
// Query keys that back this page's data; refetched together on the 3-minute poll and on tab
// visibility regain, using queryClient directly since not every underlying hook (useTrends,
// usePortalBreakdown, useComplianceDaily, useSellerMapping, useLatestZfgData) exposes a
// refetchInterval option of its own.
const REFRESH_QUERY_KEYS = ["dashboard", "trends", "portal-breakdown", "compliance-daily", "seller-mapping", "latest-zfg-data"];

export default function DashboardPage() {
  const [dateWindow, setDateWindow] = useState(30);
  const dashboardQuery = useDashboard();
  const trendsQuery = useTrends();
  const portalBreakdownQuery = usePortalBreakdown();
  const complianceDailyQuery = useComplianceDaily(dateWindow);
  const sellerMappingQuery = useSellerMapping();
  const zfgQuery = useLatestZfgData();

  const [mappingDialogOpen, setMappingDialogOpen] = useState(false);
  const [leafDialogOpen, setLeafDialogOpen] = useState(false);
  const anyDialogOpen = mappingDialogOpen || leafDialogOpen;
  const anyDialogOpenRef = useRef(anyDialogOpen);
  useEffect(() => {
    anyDialogOpenRef.current = anyDialogOpen;
  }, [anyDialogOpen]);

  const queryClient = useQueryClient();
  useEffect(() => {
    function refreshAll() {
      if (anyDialogOpenRef.current) return;
      queryClient.refetchQueries({ predicate: (q) => REFRESH_QUERY_KEYS.includes(q.queryKey[0] as string) });
    }
    const interval = setInterval(refreshAll, REFRESH_INTERVAL_MS);
    function onVisibilityChange() {
      if (document.visibilityState === "visible") refreshAll();
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [queryClient]);

  const zfgIndex = useMemo(() => buildZfgIndex(zfgQuery.data?.rows), [zfgQuery.data]);
  const enrichedOverallRows = useMemo(() => enrichRows(dashboardQuery.data?.rows, zfgIndex), [dashboardQuery.data, zfgIndex]);
  const enrichedDailyRows = useMemo(
    () => enrichRows(complianceDailyQuery.data, zfgIndex) as EnrichedDailyRow[],
    [complianceDailyQuery.data, zfgIndex]
  );

  const channelOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of enrichedOverallRows) if (r.distMat && r.distMat !== "Unknown") set.add(r.distMat);
    return Array.from(set).sort();
  }, [enrichedOverallRows]);

  const availableDates = useMemo(() => {
    const set = new Set(enrichedDailyRows.map((r) => r.snapshot_date));
    return Array.from(set).sort((a, b) => (a < b ? 1 : -1));
  }, [enrichedDailyRows]);

  const dailyInsight = useMemo(() => {
    const dates = availableDates.slice(0, 2);
    const latestRows = dates[0] ? enrichedDailyRows.filter((row) => row.snapshot_date === dates[0]) : [];
    const previousRows = dates[1] ? enrichedDailyRows.filter((row) => row.snapshot_date === dates[1]) : [];
    const compliance = (rows: EnrichedDailyRow[]) => rows.length
      ? Math.round((rows.filter((row) => row.price_status === "AT_MOP" || row.price_status === "ABOVE_MOP").length / rows.length) * 100)
      : null;
    const latestCompliance = compliance(latestRows);
    const previousCompliance = compliance(previousRows);
    const portalRisk = new Map<string, { total: number; below: number }>();
    for (const row of latestRows) {
      const portal = row.portal || "Unknown portal";
      const current = portalRisk.get(portal) ?? { total: 0, below: 0 };
      current.total += 1;
      if (row.price_status === "BELOW_MOP") current.below += 1;
      portalRisk.set(portal, current);
    }
    const highestRisk = [...portalRisk.entries()]
      .map(([portal, counts]) => ({ portal, ...counts, rate: counts.total ? counts.below / counts.total : 0 }))
      .sort((a, b) => b.rate - a.rate || b.below - a.below)[0];
    return {
      latestDate: dates[0],
      compliance: latestCompliance,
      delta: latestCompliance !== null && previousCompliance !== null ? latestCompliance - previousCompliance : null,
      below: latestRows.filter((row) => row.price_status === "BELOW_MOP").length,
      highestRisk,
    };
  }, [availableDates, enrichedDailyRows]);

  const [matrixFilters, setMatrixFilters] = useState<ComplianceFilters>({ vertical: "ALL", portal: "ALL", channel: "ALL" });
  const matrixRef = useRef<HTMLDivElement>(null);

  function jumpToVertical(vertical: "MP" | "OR") {
    setMatrixFilters({ vertical, portal: "ALL", channel: "ALL" });
    requestAnimationFrame(() => matrixRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  const coreLoading = dashboardQuery.isPending || zfgQuery.isPending;

  return (
    <RequireAuth>
      <PageHeader
        title="MOP Dashboard"
        description="Marketplace price compliance overview"
        actions={
          <div className="flex items-center gap-2 rounded-xl border border-border/70 bg-background/80 px-3 py-2">
            <CalendarRange className="size-4 text-muted-foreground" />
            <span className="hidden text-xs font-medium text-muted-foreground sm:inline">Analysis window</span>
            <Select value={String(dateWindow)} onValueChange={(value) => setDateWindow(Number(value))}>
              <SelectTrigger size="sm" className="h-8 w-[118px] border-0 bg-transparent shadow-none focus-visible:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
      />

      <AlertBanner belowMopCount={dashboardQuery.data?.summary.below_mop ?? 0} />

      <div className="space-y-4">
        <KpiCards summary={dashboardQuery.data?.summary} loading={dashboardQuery.isPending} />

        <Card className="border-primary/15 bg-gradient-to-r from-primary/[0.055] via-card to-card shadow-sm">
          <CardContent className="grid gap-3 py-0.5 md:grid-cols-[1.15fr_1fr_1fr] md:items-center">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Activity className="size-4.5" />
              </div>
              <div>
                <p className="text-sm font-semibold tracking-tight">Daily readout</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {dailyInsight.latestDate ? `Latest snapshot · ${formatDate(dailyInsight.latestDate, { withTime: false })}` : `Last ${dateWindow} days · waiting for snapshot data`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 border-t border-border/60 pt-3 md:border-l md:border-t-0 md:pl-5 md:pt-0">
              <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Latest compliance</p>
                <p className="mt-1 flex items-center gap-2 text-lg font-bold tracking-tight tabular-nums">
                  {complianceDailyQuery.isPending ? "Loading…" : dailyInsight.compliance === null ? "—" : `${dailyInsight.compliance}%`}
                  {dailyInsight.delta !== null && (
                    <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${dailyInsight.delta >= 0 ? "text-success" : "text-destructive"}`}>
                      {dailyInsight.delta >= 0 ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
                      {Math.abs(dailyInsight.delta)} pts vs previous snapshot
                    </span>
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 border-t border-border/60 pt-3 md:border-l md:border-t-0 md:pl-5 md:pt-0">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
                <CircleAlert className="size-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Exposure to review</p>
                <p className="mt-1 truncate text-sm font-semibold">
                  {complianceDailyQuery.isPending ? "Loading snapshot…" : `${dailyInsight.below} below-MOP listings`}
                  {dailyInsight.highestRisk && <span className="font-normal text-muted-foreground"> · highest share: {portalLabel(dailyInsight.highestRisk.portal)}</span>}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <VerticalCards rows={enrichedOverallRows} loading={coreLoading} onSelectVertical={jumpToVertical} />

        <div ref={matrixRef} className="scroll-mt-6">
          <ComplianceMatrix
            overallRows={enrichedOverallRows}
            dailyRows={enrichedDailyRows}
            loadingOverall={coreLoading}
            loadingDaily={complianceDailyQuery.isPending || zfgQuery.isPending}
            channelOptions={channelOptions}
            filters={matrixFilters}
            onFiltersChange={setMatrixFilters}
            onLeafDialogOpenChange={setLeafDialogOpen}
          />
        </div>

        <PenaltyReport
          overallRows={enrichedOverallRows}
          dailyRows={enrichedDailyRows}
          availableDates={availableDates}
          mappingRows={sellerMappingQuery.data ?? []}
          loading={coreLoading}
          onOpenMapping={() => setMappingDialogOpen(true)}
        />

        <BelowMopTable rows={enrichedOverallRows} loading={coreLoading} channelOptions={channelOptions} />

        <TrendCharts
          trends={trendsQuery.data}
          trendsLoading={trendsQuery.isPending}
          portalBreakdown={portalBreakdownQuery.data}
          portalBreakdownLoading={portalBreakdownQuery.isPending}
        />
      </div>

      <SellerMappingDialog open={mappingDialogOpen} onOpenChange={setMappingDialogOpen} />
    </RequireAuth>
  );
}
