"use client";

import { useMemo } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { downloadCSV } from "@/lib/csv";
import type { Summary } from "@/lib/types";

const SLICES: { key: keyof Summary; name: string; color: string }[] = [
  { key: "below_mop", name: "Below MOP", color: "var(--destructive)" },
  { key: "at_mop", name: "At MOP", color: "var(--warning)" },
  { key: "above_mop", name: "Above MOP", color: "var(--success)" },
  { key: "unknown", name: "Unknown", color: "var(--muted-foreground)" },
];

export function StatusDonutChart({ summary }: { summary: Summary | undefined }) {
  const data = useMemo(
    () => SLICES.map((s) => ({ name: s.name, value: summary ? (summary[s.key] as number) : 0, color: s.color })),
    [summary]
  );
  const total = data.reduce((sum, d) => sum + d.value, 0);

  function handleExport() {
    downloadCSV("price-status-split.csv", ["Status", "Count"], data.map((d) => [d.name, d.value]));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Price Status Split</CardTitle>
        <CardAction>
          <Button variant="outline" size="sm" onClick={handleExport} disabled={total === 0}>
            <Download className="size-3.5" />
            CSV
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <p className="flex h-72 items-center justify-center text-sm text-muted-foreground">No data yet.</p>
        ) : (
          <div className="relative">
            <ResponsiveContainer width="100%" height={288}>
              <PieChart>
                <Pie data={data} dataKey="value" nameKey="name" innerRadius={70} outerRadius={100} paddingAngle={2}>
                  {data.map((d) => (
                    <Cell key={d.name} fill={d.color} stroke="var(--card)" strokeWidth={2} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    borderRadius: 8,
                    fontSize: 12,
                    background: "var(--popover)",
                    color: "var(--popover-foreground)",
                    border: "1px solid var(--border)",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <p className="text-xl font-semibold tabular-nums">{summary?.compliance_pct.toFixed(1) ?? "0.0"}%</p>
              <p className="text-xs text-muted-foreground">Compliance</p>
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
              {data.map((d) => (
                <span key={d.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="size-2 rounded-full" style={{ background: d.color }} />
                  {d.name} ({d.value})
                </span>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
