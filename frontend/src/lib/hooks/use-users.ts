"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { User } from "@/lib/types";

export function useUsers() {
  return useQuery({
    queryKey: ["users"],
    queryFn: async () => (await apiClient.get<{ users: User[] }>("/api/users")).data.users,
  });
}

export interface UpdateUserPayload {
  firstName: string;
  lastName?: string;
  phoneNumber?: string;
  role: string;
  designation: string;
  department?: string;
  reportingManagerId?: number | null;
  isActive: boolean;
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: UpdateUserPayload }) =>
      (await apiClient.put<{ user: User }>(`/api/users/${id}`, payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
}
