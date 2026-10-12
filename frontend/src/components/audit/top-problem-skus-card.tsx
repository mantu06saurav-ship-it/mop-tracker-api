"use client";

import { Download, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardAction } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { downloadCSV } from "@/lib/csv";
import type { TopProblemSkuRow } from "@/components/audit/audit-utils";

export function TopProblemSkusCard({ rows, loading }: { rows: TopProblemSkuRow[]; loading: boolean }) {
  function exportCsv() {
    downloadCSV(
      "audit-top-problem-skus.csv",
      ["SKU", "Article", "Portals", "Fails"],
      rows.map((row) => [row.sku, row.artical, row.portals, row.fails])
    );
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="size-4 text-muted-foreground" />
          Top Problem SKUs
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
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No failing SKUs — everything checks out.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Article</TableHead>
                <TableHead>Portals</TableHead>
                <TableHead className="text-right">Fails</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.sku}>
                  <TableCell className="font-medium">{row.sku}</TableCell>
                  <TableCell className="max-w-40 truncate">{row.artical ?? "—"}</TableCell>
                  <TableCell className="capitalize">{row.portals || "—"}</TableCell>
                  <TableCell className="text-right tabular-nums text-destructive font-medium">{row.fails}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
