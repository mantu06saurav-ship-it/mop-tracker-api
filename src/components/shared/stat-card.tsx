import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export type StatTone = "default" | "danger" | "warning" | "success" | "info";

const TONE_CLASSES: Record<StatTone, string> = {
  default: "text-foreground",
  danger: "text-destructive",
  warning: "text-warning-foreground",
  success: "text-success-foreground",
  info: "text-info-foreground",
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
      className={cn("relative overflow-hidden gap-2 py-4", onClick && "cursor-pointer transition-shadow hover:shadow-md")}
    >
      <span className={cn("absolute inset-x-0 top-0 h-1", TONE_BAR[tone])} />
      <CardContent className="flex items-start justify-between gap-3 px-4">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground truncate">{label}</p>
          {loading ? (
            <Skeleton className="h-7 w-20 mt-1.5" />
          ) : (
            <p className={cn("text-2xl font-semibold tabular-nums mt-1", TONE_CLASSES[tone])}>{value}</p>
          )}
          {hint && !loading && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
        </div>
        {Icon && (
          <div className={cn("rounded-lg p-2 bg-muted", TONE_CLASSES[tone])}>
            <Icon className="size-4" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
