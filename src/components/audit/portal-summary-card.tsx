"use client";

import { Download, Globe } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardAction } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { downloadCSV } from "@/lib/csv";
import type { PortalSummaryRow } from "@/components/audit/audit-utils";

export function PortalSummaryCard({ rows, loading }: { rows: PortalSummaryRow[]; loading: boolean }) {
  function exportCsv() {
    downloadCSV(
      "audit-portal-summary.csv",
      ["Portal", "Audited", "Fails", "Pass", "Pass %"],
      rows.map((row) => [row.portal, row.audited, row.fails, row.pass, row.passPct])
    );
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Globe className="size-4 text-muted-foreground" />
          Portal Wise Summary
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
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No portal data yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Portal</TableHead>
                <TableHead className="text-right">Audited</TableHead>
                <TableHead className="text-right">Fails</TableHead>
                <TableHead className="text-right">Pass</TableHead>
                <TableHead className="text-right">Pass %</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.portal}>
                  <TableCell className="font-medium capitalize">{row.portal}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.audited}</TableCell>
                  <TableCell className="text-right tabular-nums text-destructive">{row.fails}</TableCell>
                  <TableCell className="text-right tabular-nums text-success-foreground">{row.pass}</TableCell>
                  <TableCell className="text-right tabular-nums font-medium">{row.passPct}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
