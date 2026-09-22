"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Save, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useCreateSellerMapping,
  useDeleteSellerMapping,
  useSellerMapping,
  useUpdateSellerMapping,
  type SellerMappingPayload,
} from "@/lib/hooks/use-seller-mapping";
import { apiErrorMessage } from "@/lib/api-client";
import { PORTALS } from "@/lib/types";
import type { SellerMappingRow } from "@/lib/types";
import { portalLabel } from "@/components/dashboard/utils";

const EMPTY_DRAFT: SellerMappingPayload = { seller: "", portal: "flipkart", subType: "OR", verticalHead: "", kam: "" };

function EditableRow({ row }: { row: SellerMappingRow }) {
  const [draft, setDraft] = useState<SellerMappingPayload>({
    seller: row.seller,
    portal: row.portal,
    subType: row.sub_type ?? "OR",
    verticalHead: row.vertical_head ?? "",
    kam: row.kam ?? "",
  });
  const updateMutation = useUpdateSellerMapping();
  const deleteMutation = useDeleteSellerMapping();

  async function handleSave() {
    try {
      await updateMutation.mutateAsync({ id: row.id, payload: draft });
      toast.success("Mapping updated.");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not update mapping."));
    }
  }

  async function handleDelete() {
    try {
      await deleteMutation.mutateAsync(row.id);
      toast.success("Mapping deleted.");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not delete mapping."));
    }
  }

  const busy = updateMutation.isPending || deleteMutation.isPending;

  return (
    <TableRow>
      <TableCell>
        <Input value={draft.seller} onChange={(e) => setDraft((d) => ({ ...d, seller: e.target.value }))} className="h-7 min-w-36" />
      </TableCell>
      <TableCell>
        <Select value={draft.portal} onValueChange={(v) => setDraft((d) => ({ ...d, portal: v }))}>
          <SelectTrigger size="sm" className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PORTALS.map((p) => (
              <SelectItem key={p} value={p}>
                {portalLabel(p)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <Select value={draft.subType} onValueChange={(v) => setDraft((d) => ({ ...d, subType: v }))}>
          <SelectTrigger size="sm" className="w-20">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="MP">MP</SelectItem>
            <SelectItem value="OR">OR</SelectItem>
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <Input value={draft.verticalHead} onChange={(e) => setDraft((d) => ({ ...d, verticalHead: e.target.value }))} className="h-7 min-w-32" />
      </TableCell>
      <TableCell>
        <Input value={draft.kam} onChange={(e) => setDraft((d) => ({ ...d, kam: e.target.value }))} className="h-7 min-w-32" />
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon-sm" onClick={handleSave} disabled={busy} aria-label="Save">
            {updateMutation.isPending ? <Loader2 className="animate-spin" /> : <Save />}
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={handleDelete} disabled={busy} aria-label="Delete">
            {deleteMutation.isPending ? <Loader2 className="animate-spin" /> : <Trash2 className="text-destructive" />}
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

function AddRow() {
  const [draft, setDraft] = useState<SellerMappingPayload>(EMPTY_DRAFT);
  const createMutation = useCreateSellerMapping();

  async function handleAdd() {
    if (!draft.seller.trim()) {
      toast.error("Seller name is required.");
      return;
    }
    try {
      await createMutation.mutateAsync(draft);
      toast.success("Mapping added.");
      setDraft(EMPTY_DRAFT);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not add mapping."));
    }
  }

  return (
    <TableRow className="bg-muted/30">
      <TableCell>
        <Input
          placeholder="New seller name"
          value={draft.seller}
          onChange={(e) => setDraft((d) => ({ ...d, seller: e.target.value }))}
          className="h-7 min-w-36"
        />
      </TableCell>
      <TableCell>
        <Select value={draft.portal} onValueChange={(v) => setDraft((d) => ({ ...d, portal: v }))}>
          <SelectTrigger size="sm" className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PORTALS.map((p) => (
              <SelectItem key={p} value={p}>
                {portalLabel(p)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <Select value={draft.subType} onValueChange={(v) => setDraft((d) => ({ ...d, subType: v }))}>
          <SelectTrigger size="sm" className="w-20">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="MP">MP</SelectItem>
            <SelectItem value="OR">OR</SelectItem>
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <Input
          placeholder="Vertical Head"
          value={draft.verticalHead}
          onChange={(e) => setDraft((d) => ({ ...d, verticalHead: e.target.value }))}
          className="h-7 min-w-32"
        />
      </TableCell>
      <TableCell>
        <Input placeholder="KAM" value={draft.kam} onChange={(e) => setDraft((d) => ({ ...d, kam: e.target.value }))} className="h-7 min-w-32" />
      </TableCell>
      <TableCell className="text-right">
        <Button size="sm" onClick={handleAdd} disabled={createMutation.isPending}>
          {createMutation.isPending ? <Loader2 className="animate-spin" /> : <Plus />}
          Add
        </Button>
      </TableCell>
    </TableRow>
  );
}

export function SellerMappingDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { data: rows, isPending } = useSellerMapping();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Seller Mapping</DialogTitle>
          <DialogDescription>
            Maps each seller + portal to a Vertical Head and KAM, used to route MOP-breach penalties. MP rows apply to
            Liberty&apos;s own official listing on that portal; OR rows are matched by seller name.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Seller</TableHead>
                <TableHead>Portal</TableHead>
                <TableHead>Sub-Type</TableHead>
                <TableHead>Vertical Head</TableHead>
                <TableHead>KAM</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isPending ? (
                <TableRow>
                  <TableCell colSpan={6}>
                    <Skeleton className="h-8 w-full" />
                  </TableCell>
                </TableRow>
              ) : (
                (rows ?? []).map((row) => <EditableRow key={row.id} row={row} />)
              )}
              <AddRow />
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
