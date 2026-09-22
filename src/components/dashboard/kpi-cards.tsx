import { CheckCircle2, CircleGauge, ListChecks, ShieldAlert, TrendingDown } from "lucide-react";
import { StatCard } from "@/components/shared/stat-card";
import { formatNumber } from "@/lib/format";
import type { Summary } from "@/lib/types";

export function KpiCards({ summary, loading }: { summary: Summary | undefined; loading: boolean }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <StatCard
        label="Total SKUs"
        value={formatNumber(summary?.total)}
        icon={ListChecks}
        tone="default"
        loading={loading}
      />
      <StatCard
        label="Below MOP"
        value={formatNumber(summary?.below_mop)}
        icon={TrendingDown}
        tone="danger"
        loading={loading}
      />
      <StatCard
        label="At MOP"
        value={formatNumber(summary?.at_mop)}
        icon={CircleGauge}
        tone="warning"
        loading={loading}
      />
      <StatCard
        label="Above MOP"
        value={formatNumber(summary?.above_mop)}
        icon={CheckCircle2}
        tone="success"
        loading={loading}
      />
      <StatCard
        label="Compliance %"
        value={summary ? `${summary.compliance_pct}%` : "—"}
        icon={ShieldAlert}
        tone="info"
        loading={loading}
      />
    </div>
  );
}
