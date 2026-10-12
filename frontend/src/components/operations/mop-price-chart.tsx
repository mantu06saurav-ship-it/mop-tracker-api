"use client";

import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { downloadCSV } from "@/lib/csv";
import { formatINR } from "@/lib/format";
import type { PriceStatus, TrackerRow } from "@/lib/types";

const STATUS_COLOR: Record<PriceStatus, string> = {
  BELOW_MOP: "var(--destructive)",
  AT_MOP: "var(--warning)",
  ABOVE_MOP: "var(--success)",
  UNKNOWN: "var(--muted-foreground)",
};

const MOP_COLOR = "var(--chart-1)";

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-medium">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="text-muted-foreground">
          {p.name}: <span className="font-medium text-foreground">{formatINR(p.value)}</span>
        </p>
      ))}
    </div>
  );
}

export function MopPriceChart({ rows }: { rows: TrackerRow[] }) {
  const data = useMemo(
    () =>
      rows
        .filter((r) => r.price_scraped !== null && r.mop !== null)
        .slice(0, 30)
        .map((r) => ({
          code: r.code,
          MOP: r.mop as number,
          "Selling Price": r.price_scraped as number,
          status: r.price_status,
        })),
    [rows]
  );

  function handleExport() {
    downloadCSV(
      "mop-vs-price.csv",
      ["Code", "MOP", "Selling Price", "Status"],
      data.map((d) => [d.code, d.MOP, d["Selling Price"], d.status])
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>MOP vs Selling Price per SKU (first 30)</CardTitle>
        <CardAction>
          <Button variant="outline" size="sm" onClick={handleExport} disabled={data.length === 0}>
            <Download className="size-3.5" />
            CSV
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="flex h-72 items-center justify-center text-sm text-muted-foreground">No priced products yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
              <XAxis dataKey="code" angle={-45} textAnchor="end" interval={0} height={60} tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} width={70} tickFormatter={(v) => formatINR(v)} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--muted)" }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="MOP" name="MOP" fill={MOP_COLOR} radius={[3, 3, 0, 0]} />
              <Bar dataKey="Selling Price" name="Selling Price" radius={[3, 3, 0, 0]}>
                {data.map((d) => (
                  <Cell key={d.code} fill={STATUS_COLOR[d.status] ?? STATUS_COLOR.UNKNOWN} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
