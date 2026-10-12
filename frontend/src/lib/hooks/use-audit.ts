"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { AuditReportResponse } from "@/lib/types";

export function useAuditReport() {
  return useQuery({
    queryKey: ["audit-report"],
    queryFn: async () => (await apiClient.get<AuditReportResponse>("/api/audit-report")).data,
  });
}
