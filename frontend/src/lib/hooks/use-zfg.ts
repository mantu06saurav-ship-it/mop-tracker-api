"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { LatestZfgResponse } from "@/lib/types";
import type { UploadResult } from "@/lib/hooks/use-mop-data";

export function useLatestZfgData() {
  return useQuery({
    queryKey: ["latest-zfg-data"],
    queryFn: async () => (await apiClient.get<LatestZfgResponse>("/latest-zfg-data")).data,
  });
}

export function useUploadLatestZfg() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      return (await apiClient.post<UploadResult>("/upload-latest-zfg", form)).data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["latest-zfg-data"] }),
  });
}
