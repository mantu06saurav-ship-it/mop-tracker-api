"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Boxes, Layers, Loader2, PackageCheck, Tags, Warehouse } from "lucide-react";
import { RequireAuth } from "@/components/shared/require-auth";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileDropZone } from "@/components/operations/file-drop-zone";
import { UploadResultAlert } from "@/components/operations/upload-result-alert";
import { InventoryTable } from "@/components/operations/inventory-table";
import { ZfgTable } from "@/components/operations/zfg-table";
import { useInventoryData, useUploadInventoryData } from "@/lib/hooks/use-inventory";
import { useLatestZfgData, useUploadLatestZfg } from "@/lib/hooks/use-zfg";
import type { UploadResult } from "@/lib/hooks/use-mop-data";
import { apiErrorMessage } from "@/lib/api-client";

function InventoryTab() {
  const { data, isLoading } = useInventoryData();
  const uploadMutation = useUploadInventoryData();
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reservedTotal = useMemo(
    () => (data?.rows ?? []).reduce((sum, r) => sum + Math.max(0, (r.stock_on_hand ?? 0) - (r.available_atp ?? 0)), 0),
    [data]
  );

  async function handleUpload() {
    if (!file) return;
    setError(null);
    setResult(null);
    try {
      const res = await uploadMutation.mutateAsync(file);
      setResult(res);
      toast.success("Inventory uploaded successfully.");
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Total SKUs" value={data?.summary.total_skus ?? 0} icon={Tags} loading={isLoading} />
        <StatCard label="Stock On Hand" value={data?.summary.total_stock_on_hand ?? 0} icon={Boxes} loading={isLoading} tone="info" />
        <StatCard
          label="Available (ATP)"
          value={data?.summary.total_available_atp ?? 0}
          icon={PackageCheck}
          loading={isLoading}
          tone="success"
        />
        <StatCard label="Reserved / Blocked" value={reservedTotal} icon={Warehouse} loading={isLoading} tone="warning" />
        <StatCard label="Batches" value={data?.summary.total_batches ?? 0} icon={Layers} loading={isLoading} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upload inventory</CardTitle>
          <CardDescription>Replaces inventory data with the contents of the uploaded spreadsheet.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FileDropZone file={file} onFileSelected={setFile} onRemove={() => setFile(null)} disabled={uploadMutation.isPending} />
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {result && <UploadResultAlert result={result} />}
          <Button onClick={handleUpload} disabled={!file || uploadMutation.isPending}>
            {uploadMutation.isPending && <Loader2 className="size-3.5 animate-spin" />}
            Upload to Database
          </Button>
        </CardContent>
      </Card>

      <InventoryTable rows={data?.rows ?? []} />
    </div>
  );
}

function ZfgTab() {
  const { data, isLoading } = useLatestZfgData();
  const uploadMutation = useUploadLatestZfg();
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleUpload() {
    if (!file) return;
    setError(null);
    setResult(null);
    try {
      const res = await uploadMutation.mutateAsync(file);
      setResult(res);
      toast.success("Master data (ZFG) uploaded successfully.");
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total SKUs" value={data?.summary.total_skus ?? 0} icon={Tags} loading={isLoading} />
        <StatCard label="Brands" value={data?.summary.total_brands ?? 0} icon={Boxes} loading={isLoading} tone="info" />
        <StatCard label="Classes" value={data?.summary.total_classes ?? 0} icon={Layers} loading={isLoading} />
        <StatCard
          label="Total Requirement"
          value={data?.summary.total_requirement ?? 0}
          icon={PackageCheck}
          loading={isLoading}
          tone="success"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upload SAP ZFG master data</CardTitle>
          <CardDescription>Replaces master data with the contents of the uploaded spreadsheet.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FileDropZone file={file} onFileSelected={setFile} onRemove={() => setFile(null)} disabled={uploadMutation.isPending} />
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {result && <UploadResultAlert result={result} />}
          <Button onClick={handleUpload} disabled={!file || uploadMutation.isPending}>
            {uploadMutation.isPending && <Loader2 className="size-3.5 animate-spin" />}
            Upload to Database
          </Button>
        </CardContent>
      </Card>

      <ZfgTable rows={data?.rows ?? []} />
    </div>
  );
}

function MasterDataContent() {
  return (
    <div>
      <PageHeader title="Master Data Upload" description="Manage inventory and SAP ZFG master data used across the console." />
      <Tabs defaultValue="inventory">
        <TabsList>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
          <TabsTrigger value="zfg">Master Data (ZFG)</TabsTrigger>
        </TabsList>
        <TabsContent value="inventory" className="mt-4">
          <InventoryTab />
        </TabsContent>
        <TabsContent value="zfg" className="mt-4">
          <ZfgTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function MasterDataPage() {
  return (
    <RequireAuth roles={["Super Admin"]}>
      <MasterDataContent />
    </RequireAuth>
  );
}
