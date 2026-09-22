"use client";

/**
 * Resilient scrape-job progress poller.
 *
 * Mirrors production hardening from the legacy app's polling loop, which was built around real
 * Render-free-tier flakiness: self-rescheduling setTimeout (not a fixed setInterval), exponential
 * backoff on failures, a 404 treated as immediately final ("job gone, likely a server restart —
 * but rows already saved to the DB are safe"), and 429/503 treated as transient ("rate limited" /
 * "waking up") rather than fatal.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import { apiClient } from "@/lib/api-client";
import type { Job } from "@/lib/types";

const BASE_DELAY_MS = 1500;
const MAX_DELAY_MS = 12000;
const BACKOFF_FACTOR = 1.4;
const MAX_CONSECUTIVE_FAILURES = 25;

export type JobPollState =
  | { phase: "idle" }
  | { phase: "polling"; job: Job | null; note?: string }
  | { phase: "done"; job: Job }
  | { phase: "failed"; job: Job }
  | { phase: "interrupted"; job: Job | null; message: string }
  | { phase: "gave-up"; job: Job | null };

export function useJobPolling() {
  const [state, setState] = useState<JobPollState>({ phase: "idle" });
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const delayRef = useRef(BASE_DELAY_MS);
  const failuresRef = useRef(0);
  const jobIdRef = useRef<string | null>(null);
  const stoppedRef = useRef(false);

  const stop = useCallback(() => {
    stoppedRef.current = true;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  // `poll` reschedules itself via setTimeout; it reads its own latest closure through this ref
  // (rather than referencing the `poll` binding directly) so the recursive call always sees
  // up-to-date refs/state setters without needing `poll` in its own dependency array.
  const pollRef = useRef<() => Promise<void>>(async () => {});

  const poll = useCallback(async () => {
    const jobId = jobIdRef.current;
    if (!jobId || stoppedRef.current) return;

    try {
      const { data } = await apiClient.get<Job>(`/job/${jobId}`);
      failuresRef.current = 0;
      delayRef.current = BASE_DELAY_MS;

      if (data.status === "DONE") {
        setState({ phase: "done", job: data });
        return;
      }
      if (data.status === "FAILED") {
        setState({ phase: "failed", job: data });
        return;
      }
      setState({ phase: "polling", job: data });
      timeoutRef.current = setTimeout(() => pollRef.current(), delayRef.current);
    } catch (err) {
      const status = axios.isAxiosError(err) ? err.response?.status : undefined;

      if (status === 404) {
        setState({
          phase: "interrupted",
          job: null,
          message: "Job progress was lost (likely a server restart). Rows already saved are safe — check History.",
        });
        return;
      }

      failuresRef.current += 1;
      if (failuresRef.current >= MAX_CONSECUTIVE_FAILURES) {
        setState((prev) => ({ phase: "gave-up", job: prev.phase === "polling" ? prev.job : null }));
        return;
      }

      delayRef.current = Math.min(delayRef.current * BACKOFF_FACTOR, MAX_DELAY_MS);
      const note =
        status === 429 || status === 503 ? "Server is rate-limited or waking up — retrying…" : "Connection hiccup — retrying…";
      setState((prev) => ({ phase: "polling", job: prev.phase === "polling" ? prev.job : null, note }));
      timeoutRef.current = setTimeout(() => pollRef.current(), delayRef.current);
    }
  }, []);

  useEffect(() => {
    pollRef.current = poll;
  }, [poll]);

  const start = useCallback(
    (jobId: string) => {
      stoppedRef.current = false;
      jobIdRef.current = jobId;
      delayRef.current = BASE_DELAY_MS;
      failuresRef.current = 0;
      setState({ phase: "polling", job: null });
      void pollRef.current();
    },
    []
  );

  const reset = useCallback(() => {
    stop();
    setState({ phase: "idle" });
  }, [stop]);

  useEffect(() => stop, [stop]);

  return { state, start, stop, reset };
}
