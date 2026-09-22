"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { SellerMappingRow } from "@/lib/types";

export function useSellerMapping() {
  return useQuery({
    queryKey: ["seller-mapping"],
    queryFn: async () => (await apiClient.get<{ rows: SellerMappingRow[] }>("/api/seller-mapping")).data.rows,
  });
}

export interface SellerMappingPayload {
  seller: string;
  portal: string;
  subType?: string;
  verticalHead: string;
  kam: string;
}

export function useCreateSellerMapping() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: SellerMappingPayload) => (await apiClient.post("/api/seller-mapping", payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["seller-mapping"] }),
  });
}

export function useUpdateSellerMapping() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: SellerMappingPayload }) =>
      (await apiClient.put(`/api/seller-mapping/${id}`, payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["seller-mapping"] }),
  });
}

export function useDeleteSellerMapping() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => (await apiClient.delete(`/api/seller-mapping/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["seller-mapping"] }),
  });
}

export function useToggleSellerMappingEmail() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, emailActive }: { id: number; emailActive: boolean }) =>
      (await apiClient.put(`/api/seller-mapping/${id}/email-toggle`, { emailActive })).data,
    onMutate: async ({ id, emailActive }) => {
      await qc.cancelQueries({ queryKey: ["seller-mapping"] });
      const previous = qc.getQueryData<SellerMappingRow[]>(["seller-mapping"]);
      qc.setQueryData<SellerMappingRow[]>(["seller-mapping"], (rows) =>
        rows?.map((r) => (r.id === id ? { ...r, email_active: emailActive } : r))
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) qc.setQueryData(["seller-mapping"], context.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["seller-mapping"] }),
  });
}
