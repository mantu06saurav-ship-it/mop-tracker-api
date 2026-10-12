"use client";

import { useState } from "react";
import { Loader2, Mail } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiClient, apiErrorMessage } from "@/lib/api-client";
import { useAuthStore } from "@/lib/stores/auth-store";

export function EmailReportDialog({ belowMopCount }: { belowMopCount: number }) {
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState("");
  const [sending, setSending] = useState(false);
  const userEmail = useAuthStore((s) => s.user?.Email);

  async function handleSend() {
    if (!to.trim()) {
      toast.error("Enter a recipient email address.");
      return;
    }
    setSending(true);
    try {
      await apiClient.post("/send-below-mop-report", { to: to.trim() });
      toast.success(`Below-MOP report sent to ${to.trim()}.`);
      setOpen(false);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not send the report."));
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v && !to) setTo(userEmail ?? "");
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Mail className="size-3.5" />
          Email Report
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Email below-MOP report</DialogTitle>
          <DialogDescription>
            Sends the current below-MOP breakdown ({belowMopCount} product{belowMopCount === 1 ? "" : "s"}) to the recipient below.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="report-to">Recipient email</Label>
          <Input
            id="report-to"
            type="email"
            placeholder="name@company.com"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button onClick={handleSend} disabled={sending}>
            {sending && <Loader2 className="size-3.5 animate-spin" />}
            Send Report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
