import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export type StatTone = "default" | "danger" | "warning" | "success" | "info";

const TONE_CLASSES: Record<StatTone, string> = {
  default: "text-foreground",
  danger: "text-destructive",
  warning: "text-warning",
  success: "text-success",
  info: "text-info",
};

const TONE_BAR: Record<StatTone, string> = {
  default: "bg-primary",
  danger: "bg-destructive",
  warning: "bg-warning",
  success: "bg-success",
  info: "bg-info",
};

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "default",
  loading,
  hint,
  onClick,
}: {
  label: string;
  value: React.ReactNode;
  icon?: LucideIcon;
  tone?: StatTone;
  loading?: boolean;
  hint?: string;
  onClick?: () => void;
}) {
  return (
    <Card
      onClick={onClick}
      className={cn(
        "relative overflow-hidden gap-1.5 border border-border/70 bg-gradient-to-br from-card to-card/95 py-3 shadow-sm transition-all duration-200",
        onClick && "cursor-pointer hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/5"
      )}
    >
      <span className={cn("absolute inset-x-0 top-0 h-1", TONE_BAR[tone])} />
      <CardContent className="flex items-start justify-between gap-2.5 px-3.5">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/80">{label}</p>
          {loading ? (
            <Skeleton className="mt-2.5 h-8 w-20" />
          ) : (
            <p className={cn("mt-1.5 text-[1.5rem] font-bold tracking-[-0.04em] tabular-nums", TONE_CLASSES[tone])}>{value}</p>
          )}
          {hint && !loading && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
        </div>
        {Icon && (
          <div className={cn("flex size-8.5 shrink-0 items-center justify-center rounded-lg border border-current/10 bg-muted/60", TONE_CLASSES[tone])}>
            <Icon className="size-4" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
