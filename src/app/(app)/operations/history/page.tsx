"use client";

import { AlertTriangle, Inbox, RefreshCw } from "lucide-react";
import { RequireAuth } from "@/components/shared/require-auth";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { useBatches } from "@/lib/hooks/use-dashboard";
import { formatDate, formatNumber } from "@/lib/format";
import { apiErrorMessage } from "@/lib/api-client";

function HistoryContent() {
  const { data: batches, isLoading, isError, error, refetch, isFetching } = useBatches();

  return (
    <div>
      <PageHeader
        title="History"
        description="Every scrape batch that's been run, most recent first."
        actions={
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`size-3.5 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        }
      />

      {isError && (
        <Alert variant="destructive" className="mb-4">
          <AlertTriangle />
          <AlertTitle>Could not load batch history</AlertTitle>
          <AlertDescription>{apiErrorMessage(error, "Please try refreshing.")}</AlertDescription>
        </Alert>
      )}

      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      )}

      {!isLoading && !isError && (!batches || batches.length === 0) && (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-6 py-16 text-center text-muted-foreground">
          <Inbox className="size-6" />
          <p className="text-sm">No scrape batches yet.</p>
        </div>
      )}

      {!isLoading && batches && batches.length > 0 && (
        <div className="space-y-3">
          {batches.map((batch) => (
            <Card key={batch.batch_id}>
              <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-mono text-sm font-medium">{batch.batch_id}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{formatDate(batch.scraped_at)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground">{formatNumber(batch.total)} products</span>
                  <Badge variant={batch.below_mop > 0 ? "destructive" : "outline"}>{batch.below_mop} below MOP</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default function HistoryPage() {
  return (
    <RequireAuth roles={["Super Admin"]}>
      <HistoryContent />
    </RequireAuth>
  );
}
