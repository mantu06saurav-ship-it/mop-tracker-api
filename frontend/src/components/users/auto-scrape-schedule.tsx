"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarClock, Check, Clock3, Loader2, Plus, RotateCcw, X } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { apiErrorMessage } from "@/lib/api-client";
import { useScrapeSchedule, useUpdateScrapeSchedule } from "@/lib/hooks/use-scrape-schedule";
import type { ScrapeSchedule, ScrapeScheduleResponse } from "@/lib/types";

const STANDARD_TIMES = ["00:00", "06:00", "12:00", "18:00"];

/** One-line status of the scraper PC's most recent run, for the schedule card and upload page. */
export function describeLastRun(schedule: ScrapeSchedule, timeZone: string): string {
  const format = (value: string | null) =>
    value
      ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone }).format(new Date(value))
      : "an unknown time";
  const summary = schedule.last_run_summary ? `: ${schedule.last_run_summary}` : ".";
  switch (schedule.last_run_status) {
    case "RUNNING":
      return `A price check is running on the scraper PC (started ${format(schedule.last_run_started_at)}).`;
    case "DONE":
      return `Last price check finished ${format(schedule.last_run_finished_at)}${summary}`;
    case "FAILED":
      return `Last price check failed ${format(schedule.last_run_finished_at)}${summary}`;
    case "INTERRUPTED":
      return `Last price check (started ${format(schedule.last_run_started_at)}) stopped before finishing — the scraper PC was likely shut down or restarted.`;
    default:
      return "No price check has run from the scraper PC yet.";
  }
}

function getNextRun(times: string[], enabled: boolean, now: Date): string | null {
  if (!enabled || times.length === 0) return null;
  const localParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) => localParts.find((item) => item.type === type)?.value ?? "0";
  const today = Date.UTC(Number(part("year")), Number(part("month")) - 1, Number(part("day")));
  const candidates = times.flatMap((time) => {
    const [hour, minute] = time.split(":").map(Number);
    return [0, 1].map((dayOffset) => today + dayOffset * 86_400_000 + (hour * 60 + minute - 330) * 60_000);
  }).filter((timestamp) => timestamp > now.getTime()).sort((a, b) => a - b);
  if (!candidates.length) return null;
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(candidates[0]);
}

function formatTime(time: string) {
  const [hour, minute] = time.split(":").map(Number);
  return new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", hour12: true }).format(
    new Date(2000, 0, 1, hour, minute)
  );
}

function ScheduleForm({ data }: { data: ScrapeScheduleResponse }) {
  const [enabled, setEnabled] = useState(data.schedule.enabled);
  const [times, setTimes] = useState(data.schedule.times);
  const [newTime, setNewTime] = useState("");
  const [now, setNow] = useState(() => new Date());
  const updateMutation = useUpdateScrapeSchedule();
  const nextRun = useMemo(() => getNextRun(times, enabled, now), [times, enabled, now]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  function addTime(value = newTime) {
    if (!value || times.includes(value) || times.length >= 24) return;
    setTimes((current) => [...current, value].sort());
    setNewTime("");
  }

  function removeTime(value: string) {
    setTimes((current) => current.filter((time) => time !== value));
  }

  async function save() {
    try {
      await updateMutation.mutateAsync({ enabled, times });
      toast.success("Auto-scrape schedule saved");
    } catch (error) {
      toast.error(apiErrorMessage(error, "Could not save the auto-scrape schedule."));
    }
  }

  const isDirty = enabled !== data.schedule.enabled || times.join(",") !== data.schedule.times.join(",");

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <CalendarClock className="size-4.5" />
          </div>
          <div>
            <CardTitle>Auto-scrape schedule</CardTitle>
            <CardDescription className="mt-1">Choose when the scraper PC runs the marketplace price check each day.</CardDescription>
          </div>
        </div>
        <Badge variant={isDirty ? "outline" : enabled ? "default" : "secondary"} className="shrink-0">
          {isDirty ? "Unsaved changes" : enabled ? "Active" : "Paused"}
        </Badge>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-4 rounded-lg border bg-muted/25 px-3.5 py-3">
          <div className="space-y-1">
            <Label htmlFor="auto-scrape-enabled" className="text-sm">Enable automatic scraping</Label>
            <p className="text-xs text-muted-foreground">Runs all configured marketplaces at the selected times.</p>
          </div>
          <Switch id="auto-scrape-enabled" checked={enabled} onCheckedChange={setEnabled} />
        </div>

        <div className="space-y-2.5">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <Label>Daily run times</Label>
              <p className="mt-1 text-xs text-muted-foreground">Times use India Standard Time (IST).</p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setTimes([...STANDARD_TIMES])}
              disabled={times.join(",") === STANDARD_TIMES.join(",")}
            >
              <RotateCcw /> Standard times
            </Button>
          </div>

          <div className="flex flex-wrap gap-2 rounded-lg border bg-background p-3">
            {times.length ? times.map((time) => (
              <div key={time} className="inline-flex items-center gap-1 rounded-md border bg-muted/50 py-1 pl-2.5 pr-1">
                <Clock3 className="size-3.5 text-muted-foreground" />
                <span className="text-sm font-medium tabular-nums">{formatTime(time)}</span>
                <Button
                  type="button"
                  size="icon-xs"
                  variant="ghost"
                  className="ml-0.5 text-muted-foreground hover:text-destructive"
                  onClick={() => removeTime(time)}
                  aria-label={`Remove ${formatTime(time)} run time`}
                >
                  <X />
                </Button>
              </div>
            )) : (
              <p className="px-1 py-1 text-sm text-muted-foreground">No run times selected.</p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Input
              aria-label="Add a daily run time"
              type="time"
              value={newTime}
              onChange={(event) => setNewTime(event.target.value)}
              className="w-36"
            />
            <Button type="button" size="sm" variant="outline" onClick={() => addTime()} disabled={!newTime || times.includes(newTime) || times.length >= 24}>
              <Plus /> Add time
            </Button>
            <div className="ml-auto flex flex-wrap gap-1.5">
              {STANDARD_TIMES.map((time) => (
                <Button
                  key={time}
                  type="button"
                  size="xs"
                  variant="ghost"
                  onClick={() => addTime(time)}
                  disabled={times.includes(time) || times.length >= 24}
                  className="text-xs text-muted-foreground"
                >
                  {formatTime(time)}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <Alert className="bg-primary/[0.04]">
          <Clock3 />
          <AlertDescription>
            {enabled
              ? nextRun ? <>{isDirty ? "After saving, next run" : "Next run"} <span className="font-semibold text-foreground">{nextRun} IST</span>. The sweep checks Flipkart, Amazon, Myntra, Snapdeal, and Ajio.</>
                : "Choose at least one run time to enable the schedule."
              : "Automatic scraping is paused. No marketplace prices are checked until it is turned back on."}
          </AlertDescription>
        </Alert>

        <p className="text-xs text-muted-foreground">{describeLastRun(data.schedule, data.timezone)}</p>

        {enabled && times.length === 0 && (
          <p className="text-xs text-destructive">Add a run time before enabling the schedule.</p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <p className="text-xs text-muted-foreground">
            {data.schedule.updated_at
              ? `Last updated ${new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: data.timezone }).format(new Date(data.schedule.updated_at))}${data.schedule.updated_by ? ` by ${data.schedule.updated_by}` : ""}`
              : "Using the default daily schedule."}
          </p>
          <Button onClick={save} disabled={!isDirty || updateMutation.isPending || (enabled && times.length === 0)}>
            {updateMutation.isPending ? <Loader2 className="animate-spin" /> : <Check />}
            Save schedule
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function AutoScrapeSchedule() {
  const { data, isLoading, isError, refetch } = useScrapeSchedule();
  if (isLoading) return <Skeleton className="h-80 w-full rounded-xl" />;
  if (isError || !data) {
    return (
      <Alert variant="destructive">
        <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
          Could not load the auto-scrape schedule.
          <Button size="sm" variant="outline" onClick={() => refetch()}>Try again</Button>
        </AlertDescription>
      </Alert>
    );
  }
  return <ScheduleForm key={data.schedule.updated_at ?? "default"} data={data} />;
}
