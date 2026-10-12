"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { EmailSettingsResponse } from "@/lib/types";

export function useEmailSettings() {
  return useQuery({
    queryKey: ["email-settings"],
    queryFn: async () => (await apiClient.get<EmailSettingsResponse>("/api/email-settings")).data,
  });
}

export interface EmailSettingsPayload {
  mode: "auto" | "manual";
  toEmails: string[];
  ccEmails: string[];
  sendTime: string;
  enabled: boolean;
}

export function useUpdateEmailSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: EmailSettingsPayload) => (await apiClient.put("/api/email-settings", payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["email-settings"] }),
  });
}

export function useSendEmailNow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => (await apiClient.post("/api/email-settings/send-now")).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["email-settings"] }),
  });
}

export function useSendBelowMopReport() {
  return useMutation({
    mutationFn: async (to: string) =>
      (await apiClient.post<{ sent: boolean; below_mop_count: number }>("/send-below-mop-report", { to })).data,
  });
}
