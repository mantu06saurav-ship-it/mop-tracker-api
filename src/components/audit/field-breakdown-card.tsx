"use client";

import { Download, ListChecks } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardAction } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { downloadCSV } from "@/lib/csv";
import type { FieldBreakdownRow } from "@/components/audit/audit-utils";

export function FieldBreakdownCard({ rows, loading }: { rows: FieldBreakdownRow[]; loading: boolean }) {
  function exportCsv() {
    downloadCSV(
      "audit-field-breakdown.csv",
      ["Field", "Fails", "Fail %"],
      rows.map((row) => [row.field, row.fails, row.failPct])
    );
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <ListChecks className="size-4 text-muted-foreground" />
          Field Wise Failure Breakdown
        </CardTitle>
        <CardAction>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={loading || rows.length === 0}>
            <Download className="size-3.5" data-icon="inline-start" />
            CSV
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No field data yet.</p>
        ) : (
          <div className="space-y-3">
            {rows.map((row) => (
              <div key={row.field}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="font-medium">{row.field}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {row.fails} <span className="text-xs">({row.failPct}%)</span>
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-destructive"
                    style={{ width: `${Math.min(100, row.failPct)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
