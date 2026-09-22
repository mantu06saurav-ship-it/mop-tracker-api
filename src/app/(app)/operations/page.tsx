"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, CircleSlash, Download, Package, RefreshCw, TrendingDown, TrendingUp } from "lucide-react";
import { RequireAuth } from "@/components/shared/require-auth";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Button } from "@/components/ui/button";
import { EmailReportDialog } from "@/components/operations/email-report-dialog";
import { MopPriceChart } from "@/components/operations/mop-price-chart";
import { StatusDonutChart } from "@/components/operations/status-donut-chart";
import { ProductsTable } from "@/components/operations/products-table";
import { BatchesTable } from "@/components/operations/batches-table";
import { useDashboard, useBatches } from "@/lib/hooks/use-dashboard";
import { useQueryClient } from "@tanstack/react-query";
import { API_URL, apiErrorMessage } from "@/lib/api-client";
import { useAuthStore } from "@/lib/stores/auth-store";
import { downloadFileFromApi } from "@/lib/csv";

function OperationsOverview() {
  const { data, isLoading } = useDashboard();
  const { data: batches, isLoading: batchesLoading } = useBatches();
  const queryClient = useQueryClient();
  const token = useAuthStore((s) => s.token);
  const [downloading, setDownloading] = useState(false);

  async function handleRefresh() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      queryClient.invalidateQueries({ queryKey: ["batches"] }),
    ]);
    toast.success("Refreshed.");
  }

  async function handleDownload() {
    setDownloading(true);
    try {
      await downloadFileFromApi("/report/download", API_URL, token, "mop-report.xlsx");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not download the report."));
    } finally {
      setDownloading(false);
    }
  }

  const summary = data?.summary;
  const rows = data?.rows ?? [];

  return (
    <div>
      <PageHeader
        title="Operations"
        description="Live MOP compliance across every marketplace."
        actions={
          <>
            <EmailReportDialog belowMopCount={summary?.below_mop ?? 0} />
            <Button variant="outline" size="sm" onClick={handleDownload} disabled={downloading}>
              <Download className="size-3.5" />
              Download
            </Button>
            <Button variant="outline" size="sm" onClick={handleRefresh}>
              <RefreshCw className="size-3.5" />
              Refresh
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Total SKUs" value={summary?.total ?? 0} icon={Package} loading={isLoading} />
        <StatCard label="Below MOP" value={summary?.below_mop ?? 0} icon={TrendingDown} tone="danger" loading={isLoading} />
        <StatCard label="At MOP" value={summary?.at_mop ?? 0} icon={CircleSlash} tone="warning" loading={isLoading} />
        <StatCard label="Above MOP" value={summary?.above_mop ?? 0} icon={TrendingUp} tone="success" loading={isLoading} />
        <StatCard
          label="Compliance %"
          value={summary ? `${summary.compliance_pct.toFixed(1)}%` : "0%"}
          icon={CheckCircle2}
          tone="info"
          loading={isLoading}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <MopPriceChart rows={rows} />
        <StatusDonutChart summary={summary} />
      </div>

      <div className="mt-4">
        <ProductsTable rows={rows} />
      </div>

      <div className="mt-4">
        <BatchesTable batches={batches ?? []} />
        {batchesLoading && !batches && <p className="mt-2 text-xs text-muted-foreground">Loading batches…</p>}
      </div>
    </div>
  );
}

export default function OperationsPage() {
  return (
    <RequireAuth roles={["Super Admin", "Manager"]}>
      <OperationsOverview />
    </RequireAuth>
  );
}
