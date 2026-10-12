"use client";

import {
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/format";
import type { PortalBreakdown, TrendPoint } from "@/lib/types";
import { portalLabel } from "@/components/dashboard/utils";

const CHART_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number | string; color?: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
      {label && <p className="mb-1 font-medium">{label}</p>}
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
}

export function TrendCharts({
  trends,
  trendsLoading,
  portalBreakdown,
  portalBreakdownLoading,
}: {
  trends: TrendPoint[] | undefined;
  trendsLoading: boolean;
  portalBreakdown: PortalBreakdown[] | undefined;
  portalBreakdownLoading: boolean;
}) {
  const trendData = (trends ?? []).map((t) => ({
    ...t,
    label: formatDate(t.scraped_at, { withTime: false }),
  }));

  const portalData = (portalBreakdown ?? []).map((p) => ({ name: portalLabel(p.portal), total: p.total }));

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <Card className="border border-border/80 bg-card/80 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold tracking-tight">Compliance Trend</CardTitle>
          <p className="text-xs text-muted-foreground">Compliance % across recent scrape batches</p>
        </CardHeader>
        <CardContent>
          {trendsLoading ? (
            <Skeleton className="h-72 w-full rounded-xl" />
          ) : trendData.length === 0 ? (
            <p className="flex h-72 items-center justify-center text-sm text-muted-foreground">No trend data yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={288}>
              <LineChart data={trendData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                <RechartsTooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="compliance_pct" name="Compliance %" stroke="var(--chart-1)" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card className="border border-border/80 bg-card/80 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold tracking-tight">SKU Count by Portal</CardTitle>
          <p className="text-xs text-muted-foreground">Total tracked listings per marketplace</p>
        </CardHeader>
        <CardContent>
          {portalBreakdownLoading ? (
            <Skeleton className="h-72 w-full rounded-xl" />
          ) : portalData.length === 0 ? (
            <p className="flex h-72 items-center justify-center text-sm text-muted-foreground">No portal data yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={288}>
              <PieChart>
                <Pie data={portalData} dataKey="total" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={95} paddingAngle={2}>
                  {portalData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
