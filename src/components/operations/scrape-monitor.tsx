import Link from "next/link";
import { AlertTriangle, CheckCircle2, Loader2, PlugZap, RadioTower, XCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatINR } from "@/lib/format";
import type { JobPollState } from "@/lib/hooks/use-job";
import type { TrackerRow } from "@/lib/types";

function StatChip({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg bg-muted/50 px-3 py-2 text-center">
      <p className="text-lg font-semibold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

export function ScrapeMonitor({ state }: { state: JobPollState }) {
  if (state.phase === "idle") {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-6 py-8 text-center text-muted-foreground">
        <RadioTower className="size-6" />
        <p className="text-sm">Start a scrape above to see live progress here.</p>
      </div>
    );
  }

  if (state.phase === "polling") {
    const job = state.job;
    const total = job?.total ?? 0;
    const done = job?.done ?? 0;
    const percent = job?.percent ?? 0;
    const rows = job?.rows ?? [];
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Loader2 className="size-4 animate-spin text-primary" />
          <p className="text-sm font-medium">
            Scraping {done} / {total} products…
          </p>
        </div>
        <Progress value={percent} />
        {state.note && (
          <p className="flex items-center gap-1.5 text-xs text-warning">
            <AlertTriangle className="size-3.5" />
            {state.note}
          </p>
        )}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatChip label="Done" value={done} />
          <StatChip label="Saved" value={job?.inserted ?? 0} />
          <StatChip label="Total" value={total} />
          <StatChip label="Errors" value={job?.errors ?? 0} />
        </div>
        <ResultsTable rows={rows} />
      </div>
    );
  }

  if (state.phase === "done") {
    const job = state.job;
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 rounded-xl border border-success/30 bg-success/10 px-4 py-3 text-success">
          <CheckCircle2 className="size-4.5 shrink-0" />
          <div>
            <p className="text-sm font-medium">Scrape complete</p>
            <p className="text-xs opacity-90">
              {job.done} / {job.total} processed · {job.inserted} saved · {job.errors} errors
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatChip label="Done" value={job.done} />
          <StatChip label="Saved" value={job.inserted} />
          <StatChip label="Total" value={job.total} />
          <StatChip label="Errors" value={job.errors} />
        </div>
        <ResultsTable rows={job.rows} />
        <Button asChild size="sm">
          <Link href="/operations">View in Dashboard</Link>
        </Button>
      </div>
    );
  }

  if (state.phase === "failed") {
    const job = state.job;
    return (
      <div className="space-y-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-destructive">
        <div className="flex items-center gap-2">
          <XCircle className="size-4.5 shrink-0" />
          <p className="text-sm font-medium">Scrape job failed</p>
        </div>
        <p className="text-sm opacity-90">{job.last_error ?? "An unknown error occurred."}</p>
        <p className="text-xs opacity-75">
          {job.inserted} row(s) were saved to the database before the failure ({job.done} / {job.total} processed).
        </p>
      </div>
    );
  }

  if (state.phase === "interrupted") {
    return (
      <div className="space-y-2 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-warning">
        <div className="flex items-center gap-2">
          <PlugZap className="size-4.5 shrink-0" />
          <p className="text-sm font-medium">Connection interrupted</p>
        </div>
        <p className="text-sm opacity-90">{state.message}</p>
        <p className="text-xs opacity-75">Check the History page to confirm what was saved.</p>
      </div>
    );
  }

  // gave-up
  return (
    <div className="space-y-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-destructive">
      <div className="flex items-center gap-2">
        <XCircle className="size-4.5 shrink-0" />
        <p className="text-sm font-medium">Lost connection to the server</p>
      </div>
      <p className="text-sm opacity-90">
        We retried repeatedly but the server never responded. Rows already saved before this point are safe — check
        History for what made it through.
      </p>
    </div>
  );
}

function ResultsTable({ rows }: { rows: TrackerRow[] }) {
  if (rows.length === 0) {
    return <p className="rounded-lg border border-dashed px-4 py-6 text-center text-xs text-muted-foreground">No rows scraped yet…</p>;
  }
  // Newest-scraped rows appended at the end by the API — show most recent first.
  const ordered = [...rows].reverse();
  return (
    <div className="max-h-80 overflow-y-auto rounded-lg border">
      <Table>
        <TableHeader className="sticky top-0 z-10 bg-card">
          <TableRow>
            <TableHead>Code</TableHead>
            <TableHead>Price</TableHead>
            <TableHead>MOP</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Seller</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {/* Live job rows are raw scrape results with no DB id (the insert may even have failed), but
              the API only ever appends — so the original index is a stable key. */}
          {ordered.map((row, i) => (
            <TableRow key={rows.length - 1 - i}>
              <TableCell className="font-medium">{row.code}</TableCell>
              <TableCell className="tabular-nums">{formatINR(row.price_scraped)}</TableCell>
              <TableCell className="tabular-nums">{formatINR(row.mop)}</TableCell>
              <TableCell>
                <StatusBadge status={row.price_status} />
              </TableCell>
              <TableCell className="max-w-40 truncate">{row.seller ?? "—"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
