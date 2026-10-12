"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { PublicProductsResponse } from "@/lib/types";

export function usePublicProducts(limit = 1000) {
  return useQuery({
    queryKey: ["public-products", limit],
    queryFn: async () =>
      (await apiClient.get<PublicProductsResponse>("/api/products/public", { params: { limit, page: 1 } })).data,
  });
}
