"use client";

import { useMutation } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { User } from "@/lib/types";

export interface LoginPayload {
  email: string;
  password: string;
}

export function useLogin() {
  return useMutation({
    mutationFn: async (payload: LoginPayload) =>
      (await apiClient.post<{ token: string; user: User }>("/api/auth/login", payload)).data,
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: async (payload: { currentPassword: string; newPassword: string }) =>
      (await apiClient.put("/api/auth/password", payload)).data,
  });
}

export function useUploadAvatar() {
  return useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      return (await apiClient.post<{ user: User }>("/api/auth/avatar", form)).data;
    },
  });
}

export interface RegisterPayload {
  employeeCode: string;
  firstName: string;
  lastName?: string;
  email: string;
  phoneNumber?: string;
  password: string;
  role: string;
  designation: string;
  department?: string;
  reportingManagerId?: number | null;
}

export function useRegisterUser() {
  return useMutation({
    mutationFn: async (payload: RegisterPayload) =>
      (await apiClient.post<{ user: User }>("/api/auth/register", payload)).data,
  });
}
