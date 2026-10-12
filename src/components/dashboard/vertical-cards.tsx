"use client";

import { Building2, Download, Store } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { downloadCSV } from "@/lib/csv";
import { formatNumber } from "@/lib/format";
import type { EnrichedRow } from "@/components/dashboard/utils";

interface VerticalStats {
  vertical: "MP" | "OR";
  total: number;
  below: number;
  at: number;
  above: number;
  compliancePct: number;
  rows: EnrichedRow[];
}

function computeVerticalStats(rows: EnrichedRow[], vertical: "MP" | "OR"): VerticalStats {
  const subset = rows.filter((r) => r.vertical === vertical);
  const below = subset.filter((r) => r.price_status === "BELOW_MOP").length;
  const at = subset.filter((r) => r.price_status === "AT_MOP").length;
  const above = subset.filter((r) => r.price_status === "ABOVE_MOP").length;
  const compliancePct = subset.length ? Math.round(((at + above) / subset.length) * 100) : 0;
  return { vertical, total: subset.length, below, at, above, compliancePct, rows: subset };
}

function exportVertical(stats: VerticalStats) {
  downloadCSV(
    `mop-${stats.vertical.toLowerCase()}-rows`,
    ["SKU", "Portal", "Title", "Seller", "MOP", "Scraped Price", "Status"],
    stats.rows.map((r) => [r.sku, r.portal, r.title, r.seller, r.mop, r.price_scraped, r.price_status])
  );
}

function VerticalCard({
  stats,
  title,
  subtitle,
  icon: Icon,
  onSelect,
}: {
  stats: VerticalStats;
  title: string;
  subtitle: string;
  icon: typeof Building2;
  onSelect: () => void;
}) {
  return (
    <Card
      className="group cursor-pointer gap-3 border border-border/70 bg-gradient-to-br from-card to-card/95 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/5"
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onSelect();
      }}
    >
      <CardHeader className="flex-row items-center justify-between gap-2 pb-2">
        <div className="flex items-center gap-2.5">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/10">
            <Icon className="size-4.5" />
          </div>
          <div>
            <CardTitle className="text-base font-semibold tracking-tight">{title}</CardTitle>
            <p className="text-[11px] text-muted-foreground">{subtitle}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 text-muted-foreground hover:text-foreground"
          onClick={(e) => {
            e.stopPropagation();
            exportVertical(stats);
          }}
          aria-label={`Export ${title} rows`}
        >
          <Download className="size-4" />
        </Button>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-4 gap-2 text-center">
          <div className="rounded-xl bg-muted/50 px-2 py-2.5">
            <p className="text-lg font-semibold tabular-nums">{formatNumber(stats.total)}</p>
            <p className="text-[11px] text-muted-foreground">Total</p>
          </div>
          <div className="rounded-xl bg-muted/50 px-2 py-2.5">
            <p className="text-lg font-semibold tabular-nums text-destructive">{formatNumber(stats.below)}</p>
            <p className="text-[11px] text-muted-foreground">Below</p>
          </div>
          <div className="rounded-xl bg-muted/50 px-2 py-2.5">
            <p className="text-lg font-semibold tabular-nums text-warning">{formatNumber(stats.at)}</p>
            <p className="text-[11px] text-muted-foreground">At</p>
          </div>
          <div className="rounded-xl bg-muted/50 px-2 py-2.5">
            <p className="text-lg font-semibold tabular-nums text-success">{formatNumber(stats.above)}</p>
            <p className="text-[11px] text-muted-foreground">Above</p>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between rounded-xl bg-muted/55 px-3 py-2.5">
          <span className="text-xs font-medium text-muted-foreground">Compliance</span>
          <span
            className={cn(
              "text-sm font-bold tabular-nums",
              stats.compliancePct >= 80
                ? "text-success"
                : stats.compliancePct >= 50
                  ? "text-warning"
                  : "text-destructive"
            )}
          >
            {stats.compliancePct}%
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

export function VerticalCards({
  rows,
  loading,
  onSelectVertical,
}: {
  rows: EnrichedRow[];
  loading: boolean;
  onSelectVertical: (vertical: "MP" | "OR") => void;
}) {
  if (loading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <Skeleton className="h-44 w-full rounded-2xl" />
        <Skeleton className="h-44 w-full rounded-2xl" />
      </div>
    );
  }

  const mp = computeVerticalStats(rows, "MP");
  const or = computeVerticalStats(rows, "OR");

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <VerticalCard
        stats={mp}
        title="MP — Liberty Official"
        subtitle="Marketplace-official listings"
        icon={Building2}
        onSelect={() => onSelectVertical("MP")}
      />
      <VerticalCard
        stats={or}
        title="OR — Other Resellers"
        subtitle="Third-party seller listings"
        icon={Store}
        onSelect={() => onSelectVertical("OR")}
      />
    </div>
  );
}
