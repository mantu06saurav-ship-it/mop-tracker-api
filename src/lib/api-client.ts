import axios, { type AxiosError } from "axios";
import { useAuthStore } from "@/lib/stores/auth-store";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export const apiClient = axios.create({
  baseURL: API_URL,
});

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ detail?: string }>) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
      if (typeof window !== "undefined" && window.location.pathname !== "/login") {
        // Intentional hard redirect (not client-side router navigation) so the whole app state
        // (React Query cache, in-memory stores) resets cleanly after an auth failure.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

// FastAPI's own 422 validation-error responses send `detail` as an array of these — not the
// plain string our own HTTPException(detail="...") calls send — so it has to be normalized to
// text before it can ever reach React state/JSX, or "Objects are not valid as a React child".
interface ValidationErrorItem {
  msg?: string;
}

export function apiErrorMessage(error: unknown, fallback = "Something went wrong."): string {
  if (axios.isAxiosError(error)) {
    const detail = (error.response?.data as { detail?: string | ValidationErrorItem[] } | undefined)?.detail;
    if (typeof detail === "string" && detail) return detail;
    if (Array.isArray(detail) && detail.length > 0) {
      const msg = detail.map((d) => d.msg).filter(Boolean).join(" ");
      if (msg) return msg;
    }
    if (error.message) return error.message;
  }
  if (error instanceof Error) return error.message;
  return fallback;
}
