"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronDown, Loader2, PlayCircle, UploadCloud } from "lucide-react";
import { RequireAuth } from "@/components/shared/require-auth";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileDropZone } from "@/components/operations/file-drop-zone";
import { UploadResultAlert } from "@/components/operations/upload-result-alert";
import { StepStrip } from "@/components/operations/step-strip";
import { ScrapeMonitor } from "@/components/operations/scrape-monitor";
import { useUploadMopData, useRunScrapeJob, type UploadResult } from "@/lib/hooks/use-mop-data";
import { useJobPolling } from "@/lib/hooks/use-job";
import { apiErrorMessage } from "@/lib/api-client";
import { PORTALS } from "@/lib/types";

const REQUIRED_HEADERS = ["BRAND", "PORTAL", "CODE TYPE", "CODE", "SKU CODE", "MOP FOR", "MOP"];

function UploadAndScrape() {
  const queryClient = useQueryClient();

  // Step 1 — import
  const [file, setFile] = useState<File | null>(null);
  const [override, setOverride] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const uploadMutation = useUploadMopData();

  // Step 2 — scrape
  const [portal, setPortal] = useState<string>(PORTALS[0]);
  const runScrapeMutation = useRunScrapeJob();
  const jobPolling = useJobPolling();

  async function handleUpload() {
    if (!file) return;
    setUploadError(null);
    setUploadResult(null);
    try {
      const result = await uploadMutation.mutateAsync({ file, override });
      setUploadResult(result);
      toast.success("File uploaded successfully.");
    } catch (err) {
      setUploadError(apiErrorMessage(err));
    }
  }

  async function handleStartScrape() {
    try {
      const { job_id } = await runScrapeMutation.mutateAsync(portal);
      jobPolling.start(job_id);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not start the scrape job."));
    }
  }

  // Fire the dashboard refresh + toast exactly once when a job completes.
  const lastNotifiedRef = useRef<string | null>(null);
  useEffect(() => {
    if (jobPolling.state.phase !== "done") return;
    const jobId = jobPolling.state.job.job_id;
    if (jobId === lastNotifiedRef.current) return;
    lastNotifiedRef.current = jobId;
    toast.success("Scraping complete — dashboard updated.");
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    queryClient.invalidateQueries({ queryKey: ["batches"] });
  }, [jobPolling.state, queryClient]);

  return (
    <div>
      <PageHeader title="Upload & Scrape" description="Import products, then run a live price check against a marketplace." />

      <StepStrip activeStep={1} />

      <div className="space-y-4">
        {/* Step 1 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UploadCloud className="size-4" /> Step 1 · Import products
            </CardTitle>
            <CardDescription>Upload a MOP spreadsheet to add or update products in the database.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FileDropZone file={file} onFileSelected={setFile} onRemove={() => setFile(null)} disabled={uploadMutation.isPending} />

            <div className="flex items-center gap-2">
              <Checkbox id="override" checked={override} onCheckedChange={(v) => setOverride(!!v)} />
              <Label htmlFor="override" className="font-normal text-muted-foreground">
                Update existing products
              </Label>
            </div>

            <details
              className="rounded-lg border px-3 py-2 text-sm"
              open={guideOpen}
              onToggle={(e) => setGuideOpen((e.target as HTMLDetailsElement).open)}
            >
              <summary className="flex cursor-pointer list-none items-center justify-between text-muted-foreground">
                Spreadsheet column guide
                <ChevronDown className={`size-4 transition-transform ${guideOpen ? "rotate-180" : ""}`} />
              </summary>
              <div className="mt-3 space-y-2 text-muted-foreground">
                <p>The spreadsheet must include these headers (any order):</p>
                <div className="flex flex-wrap gap-1.5">
                  {REQUIRED_HEADERS.map((h) => (
                    <span key={h} className="rounded-md bg-muted px-2 py-0.5 font-mono text-xs text-foreground">
                      {h}
                    </span>
                  ))}
                </div>
              </div>
            </details>

            {uploadError && (
              <Alert variant="destructive">
                <AlertDescription>{uploadError}</AlertDescription>
              </Alert>
            )}
            {uploadResult && <UploadResultAlert result={uploadResult} />}

            <Button onClick={handleUpload} disabled={!file || uploadMutation.isPending}>
              {uploadMutation.isPending && <Loader2 className="size-3.5 animate-spin" />}
              Upload to Database
            </Button>
          </CardContent>
        </Card>

        {/* Step 2 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PlayCircle className="size-4" /> Step 2 · Run scraping
            </CardTitle>
            <CardDescription>Runs against every saved product for the chosen marketplace — no upload required here.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Select value={portal} onValueChange={setPortal}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PORTALS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p[0].toUpperCase() + p.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={handleStartScrape}
              disabled={runScrapeMutation.isPending || jobPolling.state.phase === "polling"}
            >
              {(runScrapeMutation.isPending || jobPolling.state.phase === "polling") && (
                <Loader2 className="size-3.5 animate-spin" />
              )}
              Start scraping
            </Button>
          </CardContent>
        </Card>

        {/* Step 3 */}
        <Card>
          <CardHeader>
            <CardTitle>Step 3 · Monitor results</CardTitle>
            <CardDescription>Live progress for the scrape job you just started.</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrapeMonitor state={jobPolling.state} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function UploadPage() {
  return (
    <RequireAuth roles={["Super Admin", "Manager"]}>
      <UploadAndScrape />
    </RequireAuth>
  );
}
