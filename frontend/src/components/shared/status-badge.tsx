import { cn } from "@/lib/utils";
import { STATUS_CLASSES, STATUS_DOT, STATUS_LABEL } from "@/lib/format";
import type { PriceStatus } from "@/lib/types";

export function StatusBadge({ status, className }: { status: PriceStatus | string | null | undefined; className?: string }) {
  const key = (status && status in STATUS_LABEL ? status : "UNKNOWN") as PriceStatus;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        STATUS_CLASSES[key],
        className
      )}
    >
      <span className={cn("size-1.5 rounded-full", STATUS_DOT[key])} />
      {STATUS_LABEL[key]}
    </span>
  );
}

export function BoolBadge({ ok, okLabel = "Active", badLabel = "Inactive" }: { ok: boolean; okLabel?: string; badLabel?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        ok
          ? "bg-success/15 text-success border-success/30 dark:bg-success/20"
          : "bg-destructive/15 text-destructive border-destructive/30"
      )}
    >
      <span className={cn("size-1.5 rounded-full", ok ? "bg-success" : "bg-destructive")} />
      {ok ? okLabel : badLabel}
    </span>
  );
}
