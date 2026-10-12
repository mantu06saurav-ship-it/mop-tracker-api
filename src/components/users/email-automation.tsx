"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Mail, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SellerMappingTable } from "@/components/users/seller-mapping-table";
import { useEmailSettings, useSendEmailNow, useUpdateEmailSettings } from "@/lib/hooks/use-email-settings";
import { apiErrorMessage } from "@/lib/api-client";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { EmailSettingsResponse } from "@/lib/types";

interface DeliveryInfo {
  status: "accepted" | "partial" | "failed";
  accepted?: string[];
  rejected?: string[];
  messageId?: string;
  error?: string;
  attemptedAt?: string;
}

function parseDelivery(raw: string | null): DeliveryInfo | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as DeliveryInfo;
  } catch {
    return null;
  }
}

function EmailAutomationForm({ data }: { data: EmailSettingsResponse }) {
  const updateMutation = useUpdateEmailSettings();
  const sendNowMutation = useSendEmailNow();

  const [mode, setMode] = useState<"manual" | "auto">(data.settings.mode);
  const [toEmails, setToEmails] = useState(data.settings.to_emails ?? "");
  const [ccEmails, setCcEmails] = useState(data.settings.cc_emails ?? "");
  const [sendTime, setSendTime] = useState(data.settings.send_time ?? "09:00");
  const [enabled, setEnabled] = useState(data.settings.enabled);

  async function handleSave() {
    try {
      await updateMutation.mutateAsync({
        mode,
        toEmails: toEmails.split(",").map((e) => e.trim()).filter(Boolean),
        ccEmails: ccEmails.split(",").map((e) => e.trim()).filter(Boolean),
        sendTime,
        enabled: mode === "auto" ? enabled : false,
      });
      toast.success("Email settings saved");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not save email settings."));
    }
  }

  async function handleSendNow() {
    try {
      await sendNowMutation.mutateAsync();
      toast.success("Snapshot email sent");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not send email."));
    }
  }

  const delivery = parseDelivery(data.settings.last_delivery);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="size-4" />
            Daily Snapshot Email
          </CardTitle>
          <CardDescription>Configure who receives the MOP breach snapshot and when.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-1.5">
            <Label>Sending mode</Label>
            <div className="inline-flex rounded-lg border bg-muted p-1">
              {(["manual", "auto"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    mode === m ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {m === "manual" ? "Manual" : "Auto (daily)"}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="to-emails">To</Label>
              <Input
                id="to-emails"
                value={toEmails}
                onChange={(e) => setToEmails(e.target.value)}
                placeholder="name@company.com, name2@company.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cc-emails">CC</Label>
              <Input
                id="cc-emails"
                value={ccEmails}
                onChange={(e) => setCcEmails(e.target.value)}
                placeholder="name@company.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="send-time">Send time</Label>
              <Input
                id="send-time"
                type="time"
                value={sendTime}
                onChange={(e) => setSendTime(e.target.value)}
                disabled={mode !== "auto"}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border px-3 py-2">
              <div>
                <Label htmlFor="auto-enabled">Auto-sending</Label>
                <p className="text-xs text-muted-foreground">
                  {mode !== "auto"
                    ? "Switch to Auto mode to enable scheduled sending."
                    : enabled
                      ? "Sends automatically every day at the time above."
                      : "Scheduled sending is off."}
                </p>
              </div>
              <Switch id="auto-enabled" checked={enabled} onCheckedChange={setEnabled} disabled={mode !== "auto"} />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={handleSave} disabled={updateMutation.isPending}>
              {updateMutation.isPending && <Loader2 className="size-4 animate-spin" />}
              Save Settings
            </Button>
            <Button variant="outline" onClick={handleSendNow} disabled={sendNowMutation.isPending}>
              {sendNowMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              Send Now
            </Button>
          </div>

          <Separator />

          <div className="space-y-2 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-1">
              <span className="text-muted-foreground">Last SMTP submission</span>
              <span className="font-medium">{formatDate(data.settings.last_sent_at)}</span>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-1">
              <span className="text-muted-foreground">Schedule status</span>
              <span className="font-medium">
                {data.schedule_status} ({data.timezone})
              </span>
            </div>
          </div>

          {delivery && (
            <Alert variant={delivery.status === "failed" ? "destructive" : "default"}>
              <AlertDescription className="space-y-1">
                <p className="font-medium">
                  {delivery.status === "accepted" && "Last send: accepted by SMTP"}
                  {delivery.status === "partial" && "Last send: partially accepted by SMTP"}
                  {delivery.status === "failed" && "Last send: failed"}
                </p>
                {delivery.accepted && delivery.accepted.length > 0 && (
                  <p className="text-xs">Accepted: {delivery.accepted.join(", ")}</p>
                )}
                {delivery.rejected && delivery.rejected.length > 0 && (
                  <p className="text-xs">Rejected: {delivery.rejected.join(", ")}</p>
                )}
                {delivery.messageId && <p className="text-xs">Message ID: {delivery.messageId}</p>}
                {delivery.error && <p className="text-xs">Error: {delivery.error}</p>}
                <p className="text-xs text-muted-foreground">
                  Acceptance by SMTP does not guarantee inbox delivery.
                </p>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <SellerMappingTable />
        </CardContent>
      </Card>
    </div>
  );
}

export function EmailAutomation() {
  const { data, isLoading } = useEmailSettings();

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return <EmailAutomationForm key={`${data.settings.id}-${data.settings.updated_at ?? ""}`} data={data} />;
}
