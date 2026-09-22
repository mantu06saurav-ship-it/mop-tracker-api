"use client";

import { useMutation } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

export interface UploadResult {
  total_rows_in_file: number;
  inserted: number;
  updated: number;
  skipped_duplicates_or_invalid?: number;
  skipped_invalid?: number;
}

export function useUploadMopData() {
  return useMutation({
    mutationFn: async ({ file, override }: { file: File; override: boolean }) => {
      const form = new FormData();
      form.append("file", file);
      form.append("override", override ? "true" : "false");
      return (await apiClient.post<UploadResult>("/upload-mop-data", form)).data;
    },
  });
}

export function useRunScrapeJob() {
  return useMutation({
    mutationFn: async (portal: string) =>
      (await apiClient.post<{ job_id: string; total: number }>(`/run-from-db`, null, { params: { portal } })).data,
  });
}
