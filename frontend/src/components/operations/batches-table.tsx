"use client";

import { Download } from "lucide-react";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { downloadCSV } from "@/lib/csv";
import { formatDate, formatNumber } from "@/lib/format";
import type { Batch } from "@/lib/types";

export function BatchesTable({ batches, limit = 15 }: { batches: Batch[]; limit?: number }) {
  const top = batches.slice(0, limit);

  function handleExport() {
    downloadCSV(
      "recent-batches.csv",
      ["Batch ID", "Total", "Below MOP", "Scraped At"],
      top.map((b) => [b.batch_id, b.total, b.below_mop, b.scraped_at])
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Batches</CardTitle>
        <CardAction>
          <Button variant="outline" size="sm" onClick={handleExport} disabled={top.length === 0}>
            <Download className="size-3.5" />
            CSV
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="px-0">
        <div className="overflow-x-auto px-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Batch ID</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Below MOP</TableHead>
                <TableHead>Scraped At</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {top.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-20 text-center text-muted-foreground">
                    No batches yet.
                  </TableCell>
                </TableRow>
              ) : (
                top.map((b) => (
                  <TableRow key={b.batch_id}>
                    <TableCell className="font-medium">{b.batch_id}</TableCell>
                    <TableCell className="tabular-nums">{formatNumber(b.total)}</TableCell>
                    <TableCell>
                      <Badge variant={b.below_mop > 0 ? "destructive" : "outline"}>{b.below_mop} below MOP</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(b.scraped_at)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
