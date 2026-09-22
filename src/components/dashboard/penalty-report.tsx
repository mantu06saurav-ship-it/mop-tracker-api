"use client";

import { useMemo, useState } from "react";
import { PartyPopper, Settings2, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { downloadCSV } from "@/lib/csv";
import { formatDate, formatINR, formatNumber } from "@/lib/format";
import { buildPenaltyReportRows, PENALTY_DEFAULTS } from "@/lib/penalty";
import type { SellerMappingRow } from "@/lib/types";
import type { EnrichedDailyRow, EnrichedRow } from "@/components/dashboard/utils";
import { cn } from "@/lib/utils";

export function PenaltyReport({
  overallRows,
  dailyRows,
  availableDates,
  mappingRows,
  loading,
  onOpenMapping,
}: {
  overallRows: EnrichedRow[];
  dailyRows: EnrichedDailyRow[];
  availableDates: string[];
  mappingRows: SellerMappingRow[];
  loading: boolean;
  onOpenMapping: () => void;
}) {
  const [basisDate, setBasisDate] = useState<string>("overall");
  const [tolerance, setTolerance] = useState(PENALTY_DEFAULTS.tolerance);
  const [vhRate, setVhRate] = useState(PENALTY_DEFAULTS.vhRate);
  const [kamRate, setKamRate] = useState(PENALTY_DEFAULTS.kamRate);

  const sourceRows = basisDate === "overall" ? overallRows : dailyRows.filter((r) => r.snapshot_date === basisDate);

  const belowRows = useMemo(() => sourceRows.filter((r) => r.price_status === "BELOW_MOP"), [sourceRows]);

  const penaltyRows = useMemo(
    () => buildPenaltyReportRows(belowRows, mappingRows, { tolerance, vhRate, kamRate }),
    [belowRows, mappingRows, tolerance, vhRate, kamRate]
  );

  const totals = useMemo(
    () =>
      penaltyRows.reduce(
        (acc, r) => ({
          mopValue: acc.mopValue + r.mopValue,
          portalValue: acc.portalValue + r.portalValue,
          variance: acc.variance + r.variance,
          breachedCount: acc.breachedCount + r.breachedCount,
          penaltyAmount: acc.penaltyAmount + r.penaltyAmount,
          vhPenaltyAmount: acc.vhPenaltyAmount + r.vhPenaltyAmount,
          kamPenaltyAmount: acc.kamPenaltyAmount + r.kamPenaltyAmount,
        }),
        { mopValue: 0, portalValue: 0, variance: 0, breachedCount: 0, penaltyAmount: 0, vhPenaltyAmount: 0, kamPenaltyAmount: 0 }
      ),
    [penaltyRows]
  );

  function exportCsv() {
    downloadCSV(
      "mop-breached-summary",
      [
        "Portal",
        "Vertical Head",
        "KAM",
        "Seller",
        "MOP Value",
        "Portal Value",
        "Variance",
        "Variance %",
        "Breached Articles",
        "Penalty Rate",
        "Penalty Amount",
        "VH Penalty",
        "KAM Penalty",
      ],
      penaltyRows.map((r) => [
        r.portalLabel,
        r.verticalHead,
        r.kam,
        r.seller,
        r.mopValue,
        r.portalValue,
        r.variance,
        r.variancePct,
        r.breachedCount,
        r.penaltyRate,
        r.penaltyAmount,
        r.vhPenaltyAmount,
        r.kamPenaltyAmount,
      ])
    );
  }

  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="text-lg">MOP Breached Summary — Daily Report</CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Penalty exposure for SKUs currently priced below MOP, split by seller and routed to the mapped Vertical
              Head / KAM.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={onOpenMapping}>
              <Settings2 /> Manage Mapping
            </Button>
            <Button variant="outline" size="sm" onClick={exportCsv}>
              <Download /> Export CSV
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Snapshot</Label>
            <Select value={basisDate} onValueChange={setBasisDate}>
              <SelectTrigger size="sm" className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="overall">Overall (latest)</SelectItem>
                {availableDates.map((d) => (
                  <SelectItem key={d} value={d}>
                    {formatDate(d, { withTime: false })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Gap Tolerance ₹</Label>
            <Input
              type="number"
              value={tolerance}
              onChange={(e) => setTolerance(Number(e.target.value) || 0)}
              className="h-8 w-28"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">VH Rate ₹</Label>
            <Input type="number" value={vhRate} onChange={(e) => setVhRate(Number(e.target.value) || 0)} className="h-8 w-28" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">KAM Rate ₹</Label>
            <Input type="number" value={kamRate} onChange={(e) => setKamRate(Number(e.target.value) || 0)} className="h-8 w-28" />
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        ) : belowRows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <PartyPopper className="size-8 text-success-foreground" />
            <p className="font-medium text-success-foreground">No SKUs are below MOP — zero penalty exposure right now.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Portal</TableHead>
                  <TableHead>Vertical Head</TableHead>
                  <TableHead>KAM</TableHead>
                  <TableHead>Seller</TableHead>
                  <TableHead>MOP Value (₹)</TableHead>
                  <TableHead>Portal Value (₹)</TableHead>
                  <TableHead>Var. (₹)</TableHead>
                  <TableHead>Var %</TableHead>
                  <TableHead>Breached Articles</TableHead>
                  <TableHead>Penalty Rate</TableHead>
                  <TableHead>Penalty Amount</TableHead>
                  <TableHead>VH Penalty</TableHead>
                  <TableHead>KAM Penalty</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {penaltyRows.map((r, idx) => (
                  <TableRow key={`${r.portalLabel}-${r.seller}-${idx}`} className={cn(r.verticalHead === "Unmapped" && "bg-warning/10")}>
                    <TableCell>{r.portalLabel}</TableCell>
                    <TableCell>{r.verticalHead}</TableCell>
                    <TableCell>{r.kam}</TableCell>
                    <TableCell className="max-w-40 truncate" title={r.seller}>
                      {r.seller}
                    </TableCell>
                    <TableCell className="tabular-nums">{formatINR(r.mopValue)}</TableCell>
                    <TableCell className="tabular-nums">{formatINR(r.portalValue)}</TableCell>
                    <TableCell className="tabular-nums text-destructive">{formatINR(r.variance)}</TableCell>
                    <TableCell className="tabular-nums">{r.variancePct}%</TableCell>
                    <TableCell className="tabular-nums">{r.breachedCount}</TableCell>
                    <TableCell className="tabular-nums">{formatINR(r.penaltyRate)}</TableCell>
                    <TableCell className="tabular-nums font-medium">{formatINR(r.penaltyAmount)}</TableCell>
                    <TableCell className="tabular-nums">{formatINR(r.vhPenaltyAmount)}</TableCell>
                    <TableCell className="tabular-nums">{formatINR(r.kamPenaltyAmount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={4} className="font-semibold">
                    Grand Total
                  </TableCell>
                  <TableCell className="font-semibold tabular-nums">{formatINR(totals.mopValue)}</TableCell>
                  <TableCell className="font-semibold tabular-nums">{formatINR(totals.portalValue)}</TableCell>
                  <TableCell className="font-semibold tabular-nums text-destructive">{formatINR(totals.variance)}</TableCell>
                  <TableCell>—</TableCell>
                  <TableCell className="font-semibold tabular-nums">{formatNumber(totals.breachedCount)}</TableCell>
                  <TableCell>—</TableCell>
                  <TableCell className="font-semibold tabular-nums">{formatINR(totals.penaltyAmount)}</TableCell>
                  <TableCell className="font-semibold tabular-nums">{formatINR(totals.vhPenaltyAmount)}</TableCell>
                  <TableCell className="font-semibold tabular-nums">{formatINR(totals.kamPenaltyAmount)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
