"use client";

import { useMemo, useState } from "react";
import { Download, FileSearch, RefreshCw } from "lucide-react";
import { RequireAuth } from "@/components/shared/require-auth";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { useAuditReport } from "@/lib/hooks/use-audit";
import { useAuthStore } from "@/lib/stores/auth-store";
import { API_URL, apiErrorMessage } from "@/lib/api-client";
import { downloadFileFromApi } from "@/lib/csv";
import { formatDate } from "@/lib/format";
import { toast } from "sonner";
import {
  computeFieldBreakdown,
  computeKpis,
  computePortalSummary,
  computeTopProblemSkus,
} from "@/components/audit/audit-utils";
import { AuditKpiCards } from "@/components/audit/audit-kpi-cards";
import { PortalSummaryCard } from "@/components/audit/portal-summary-card";
import { FieldBreakdownCard } from "@/components/audit/field-breakdown-card";
import { TopProblemSkusCard } from "@/components/audit/top-problem-skus-card";
import { AuditDetailSection } from "@/components/audit/audit-detail-section";

function AuditReportPageContent() {
  const { data, isPending, isFetching, refetch } = useAuditReport();
  const token = useAuthStore((s) => s.token);
  const [downloading, setDownloading] = useState(false);

  const blocks = useMemo(() => data?.blocks ?? [], [data]);
  const kpis = useMemo(() => computeKpis(blocks), [blocks]);
  const portalSummary = useMemo(() => computePortalSummary(blocks), [blocks]);
  const fieldBreakdown = useMemo(() => computeFieldBreakdown(blocks), [blocks]);
  const topProblemSkus = useMemo(() => computeTopProblemSkus(blocks), [blocks]);

  const loading = isPending;
  const isEmpty = !loading && blocks.length === 0;

  async function handleDownload() {
    setDownloading(true);
    try {
      await downloadFileFromApi("/api/audit-report/download", API_URL, token);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Failed to download the audit report."));
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Audit Report"
        description="Target vs Actual — SAP master data & MOP vs live marketplace listings"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={handleDownload} disabled={downloading}>
              <Download className="size-3.5" data-icon="inline-start" />
              Download Report
            </Button>
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`size-3.5 ${isFetching ? "animate-spin" : ""}`} data-icon="inline-start" />
              Refresh
            </Button>
          </>
        }
      />

      {data?.generated_at && (
        <p className="-mt-4 mb-6 text-xs text-muted-foreground">
          Last generated {formatDate(data.generated_at, { withTime: true })}
        </p>
      )}

      {isEmpty ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-24 text-center">
          <FileSearch className="size-10 text-muted-foreground" />
          <div>
            <p className="font-medium">No audit data yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Upload MOP data and SAP master data, then run a scrape to generate the audit report.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <AuditKpiCards kpis={kpis} loading={loading} />

          <PortalSummaryCard rows={portalSummary} loading={loading} />

          <div className="grid gap-4 lg:grid-cols-2">
            <FieldBreakdownCard rows={fieldBreakdown} loading={loading} />
            <TopProblemSkusCard rows={topProblemSkus} loading={loading} />
          </div>

          <AuditDetailSection blocks={blocks} loading={loading} />
        </div>
      )}
    </div>
  );
}

export default function AuditReportPage() {
  return (
    <RequireAuth>
      <AuditReportPageContent />
    </RequireAuth>
  );
}
