import { cn } from "@/lib/utils";
import type { AuditFieldRow } from "@/lib/types";

const REMARK_CLASSES: Record<AuditFieldRow["remark"], string> = {
  OK: "bg-success/15 text-success-foreground border-success/30 dark:bg-success/20",
  NOT_OK: "bg-destructive/15 text-destructive border-destructive/30 dark:bg-destructive/20",
  "--": "bg-muted text-muted-foreground border-border",
};

const REMARK_LABEL: Record<AuditFieldRow["remark"], string> = {
  OK: "OK",
  NOT_OK: "Not Ok",
  "--": "--",
};

const REMARK_DOT: Record<AuditFieldRow["remark"], string> = {
  OK: "bg-success",
  NOT_OK: "bg-destructive",
  "--": "bg-muted-foreground",
};

export function RemarkBadge({ remark }: { remark: AuditFieldRow["remark"] }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        REMARK_CLASSES[remark]
      )}
    >
      <span className={cn("size-1.5 rounded-full", REMARK_DOT[remark])} />
      {REMARK_LABEL[remark]}
    </span>
  );
}
