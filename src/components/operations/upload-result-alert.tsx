import { CheckCircle2 } from "lucide-react";
import { formatNumber } from "@/lib/format";
import type { UploadResult } from "@/lib/hooks/use-mop-data";

export function UploadResultAlert({ result }: { result: UploadResult }) {
  const skipped = result.skipped_duplicates_or_invalid ?? result.skipped_invalid ?? 0;
  const items = [
    { label: "Rows in file", value: result.total_rows_in_file },
    { label: "Inserted", value: result.inserted },
    { label: "Updated", value: result.updated },
    { label: "Skipped", value: skipped },
  ];
  return (
    <div className="rounded-xl border border-success/30 bg-success/10 p-4">
      <div className="mb-3 flex items-center gap-2 text-success-foreground">
        <CheckCircle2 className="size-4" />
        <p className="text-sm font-medium">Upload complete</p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {items.map((item) => (
          <div key={item.label} className="rounded-lg bg-background/60 px-3 py-2">
            <p className="text-xs text-muted-foreground">{item.label}</p>
            <p className="text-lg font-semibold tabular-nums">{formatNumber(item.value)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
