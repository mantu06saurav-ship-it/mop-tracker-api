"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { ScrapeScheduleResponse } from "@/lib/types";

export function useScrapeSchedule(enabled = true) {
  return useQuery({
    queryKey: ["scrape-schedule"],
    queryFn: async () => (await apiClient.get<ScrapeScheduleResponse>("/api/scrape-schedule")).data,
    enabled,
    staleTime: 60_000,
  });
}

export function useUpdateScrapeSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { enabled: boolean; times: string[] }) =>
      (await apiClient.put<ScrapeScheduleResponse>("/api/scrape-schedule", payload)).data,
    onSuccess: (data) => {
      queryClient.setQueryData(["scrape-schedule"], data);
    },
  });
}
