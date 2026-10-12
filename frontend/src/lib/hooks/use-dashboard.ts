"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { Batch, ComplianceDailyRow, DashboardResponse, PortalBreakdown, TrendPoint } from "@/lib/types";

export function useDashboard(opts?: { refetchInterval?: number; enabled?: boolean }) {
  return useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => (await apiClient.get<DashboardResponse>("/dashboard")).data,
    refetchInterval: opts?.refetchInterval,
    enabled: opts?.enabled ?? true,
  });
}

export function useBatches(refetchInterval?: number) {
  return useQuery({
    queryKey: ["batches"],
    queryFn: async () => (await apiClient.get<Batch[]>("/batches")).data,
    refetchInterval,
  });
}

export function useTrends() {
  return useQuery({
    queryKey: ["trends"],
    queryFn: async () => (await apiClient.get<{ batches: TrendPoint[] }>("/api/trends")).data.batches,
  });
}

export function usePortalBreakdown() {
  return useQuery({
    queryKey: ["portal-breakdown"],
    queryFn: async () => (await apiClient.get<PortalBreakdown[]>("/api/portal-breakdown")).data,
  });
}

export function useComplianceDaily(days = 30) {
  return useQuery({
    queryKey: ["compliance-daily", days],
    queryFn: async () =>
      (await apiClient.get<{ rows: ComplianceDailyRow[]; days: number }>("/api/compliance-daily", { params: { days } }))
        .data.rows,
  });
}
