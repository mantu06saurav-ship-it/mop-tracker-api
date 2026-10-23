"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CalendarClock, ChevronDown, Loader2, UploadCloud } from "lucide-react";
import { RequireAuth } from "@/components/shared/require-auth";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FileDropZone } from "@/components/operations/file-drop-zone";
import { UploadResultAlert } from "@/components/operations/upload-result-alert";
import { describeLastRun } from "@/components/users/auto-scrape-schedule";
import { useUploadMopData, type UploadResult } from "@/lib/hooks/use-mop-data";
import { useScrapeSchedule } from "@/lib/hooks/use-scrape-schedule";
import { apiErrorMessage } from "@/lib/api-client";

const REQUIRED_HEADERS = ["BRAND", "PORTAL", "CODE TYPE", "CODE", "SKU CODE", "MOP FOR", "MOP"];

function UploadProducts() {
  const [file, setFile] = useState<File | null>(null);
  const [override, setOverride] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const uploadMutation = useUploadMopData();
  const scheduleQuery = useScrapeSchedule();

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

  return (
    <div>
      <PageHeader title="Upload Products" description="Import or update the products whose marketplace prices are tracked." />

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UploadCloud className="size-4" /> Import products
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

        <Alert className="bg-primary/[0.04]">
          <CalendarClock />
          <AlertDescription className="space-y-1">
            <p>
              Marketplace prices are checked automatically by the scraper PC on its schedule. Uploaded products are
              included in the next run.
            </p>
            {scheduleQuery.data && (
              <p className="text-xs">{describeLastRun(scheduleQuery.data.schedule, scheduleQuery.data.timezone)}</p>
            )}
          </AlertDescription>
        </Alert>
      </div>
    </div>
  );
}

export default function UploadPage() {
  return (
    <RequireAuth roles={["Super Admin", "Manager"]}>
      <UploadProducts />
    </RequireAuth>
  );
}
