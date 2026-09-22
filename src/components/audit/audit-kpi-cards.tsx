import { Layers, XCircle, CheckCircle2, FileWarning, Package } from "lucide-react";
import { StatCard } from "@/components/shared/stat-card";
import { formatNumber } from "@/lib/format";
import type { AuditKpis } from "@/components/audit/audit-utils";

export function AuditKpiCards({ kpis, loading }: { kpis: AuditKpis; loading: boolean }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <StatCard
        label="Total Blocks"
        value={formatNumber(kpis.totalBlocks)}
        icon={Layers}
        tone="default"
        loading={loading}
        hint="SKU + portal combinations"
      />
      <StatCard
        label="Not OK Fields"
        value={formatNumber(kpis.notOkFields)}
        icon={XCircle}
        tone="danger"
        loading={loading}
        hint="Failed checks across all blocks"
      />
      <StatCard
        label="SKUs Fully OK"
        value={formatNumber(kpis.skusFullyOk)}
        icon={CheckCircle2}
        tone="success"
        loading={loading}
        hint="No fails on any portal"
      />
      <StatCard
        label="Missing ZFG"
        value={formatNumber(kpis.missingZfg)}
        icon={FileWarning}
        tone="warning"
        loading={loading}
        hint="Blocks without SAP master data"
      />
      <StatCard
        label="SKUs Audited"
        value={formatNumber(kpis.skusAudited)}
        icon={Package}
        tone="info"
        loading={loading}
        hint="Distinct SKUs covered"
      />
    </div>
  );
}
