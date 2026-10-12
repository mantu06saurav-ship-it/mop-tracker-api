"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { InventoryResponse } from "@/lib/types";
import type { UploadResult } from "@/lib/hooks/use-mop-data";

export function useInventoryData() {
  return useQuery({
    queryKey: ["inventory-data"],
    queryFn: async () => (await apiClient.get<InventoryResponse>("/inventory-data")).data,
  });
}

export function useUploadInventoryData() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      return (await apiClient.post<UploadResult>("/upload-inventory-data", form)).data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["inventory-data"] }),
  });
}
