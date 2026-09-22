"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { RequireAuth } from "@/components/shared/require-auth";
import { PageHeader } from "@/components/shared/page-header";
import { useComplianceDaily, useDashboard, usePortalBreakdown, useTrends } from "@/lib/hooks/use-dashboard";
import { useSellerMapping } from "@/lib/hooks/use-seller-mapping";
import { useLatestZfgData } from "@/lib/hooks/use-zfg";
import { AlertBanner } from "@/components/dashboard/alert-banner";
import { KpiCards } from "@/components/dashboard/kpi-cards";
import { VerticalCards } from "@/components/dashboard/vertical-cards";
import { ComplianceMatrix, type ComplianceFilters } from "@/components/dashboard/compliance-matrix";
import { PenaltyReport } from "@/components/dashboard/penalty-report";
import { SellerMappingDialog } from "@/components/dashboard/seller-mapping-dialog";
import { BelowMopTable } from "@/components/dashboard/below-mop-table";
import { TrendCharts } from "@/components/dashboard/trend-charts";
import { buildZfgIndex, enrichRows, type EnrichedDailyRow } from "@/components/dashboard/utils";

const REFRESH_INTERVAL_MS = 3 * 60 * 1000;
// Query keys that back this page's data; refetched together on the 3-minute poll and on tab
// visibility regain, using queryClient directly since not every underlying hook (useTrends,
// usePortalBreakdown, useComplianceDaily, useSellerMapping, useLatestZfgData) exposes a
// refetchInterval option of its own.
const REFRESH_QUERY_KEYS = ["dashboard", "trends", "portal-breakdown", "compliance-daily", "seller-mapping", "latest-zfg-data"];

export default function DashboardPage() {
  const dashboardQuery = useDashboard();
  const trendsQuery = useTrends();
  const portalBreakdownQuery = usePortalBreakdown();
  const complianceDailyQuery = useComplianceDaily(30);
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

  const [matrixFilters, setMatrixFilters] = useState<ComplianceFilters>({ vertical: "ALL", portal: "ALL", channel: "ALL" });
  const matrixRef = useRef<HTMLDivElement>(null);

  function jumpToVertical(vertical: "MP" | "OR") {
    setMatrixFilters({ vertical, portal: "ALL", channel: "ALL" });
    requestAnimationFrame(() => matrixRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  const coreLoading = dashboardQuery.isPending || zfgQuery.isPending;

  return (
    <RequireAuth>
      <PageHeader title="MOP Dashboard" description="Marketplace price compliance overview" />

      <AlertBanner belowMopCount={dashboardQuery.data?.summary.below_mop ?? 0} />

      <div className="space-y-6">
        <KpiCards summary={dashboardQuery.data?.summary} loading={dashboardQuery.isPending} />

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
