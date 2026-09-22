import type { PriceStatus } from "@/lib/types";

export function formatINR(value: number | null | undefined, opts?: { decimals?: number }): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: opts?.decimals ?? 0,
  }).format(value);
}

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("en-IN").format(value);
}

export function formatDate(value: string | null | undefined, opts?: { withTime?: boolean }): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  if (opts?.withTime === false) {
    return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(date);
  }
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function timeAgo(value: string | null | undefined): string {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Never";
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(value, { withTime: false });
}

export const STATUS_LABEL: Record<PriceStatus, string> = {
  BELOW_MOP: "Below MOP",
  AT_MOP: "At MOP",
  ABOVE_MOP: "Above MOP",
  UNKNOWN: "Unknown",
};

/** Tailwind class groups keyed by semantic status — used for badges, dots, and bars. */
export const STATUS_CLASSES: Record<PriceStatus, string> = {
  BELOW_MOP: "bg-destructive/15 text-destructive border-destructive/30 dark:bg-destructive/20",
  AT_MOP: "bg-warning/20 text-warning-foreground border-warning/40 dark:bg-warning/25",
  ABOVE_MOP: "bg-success/15 text-success-foreground border-success/30 dark:bg-success/20",
  UNKNOWN: "bg-muted text-muted-foreground border-border",
};

export const STATUS_DOT: Record<PriceStatus, string> = {
  BELOW_MOP: "bg-destructive",
  AT_MOP: "bg-warning",
  ABOVE_MOP: "bg-success",
  UNKNOWN: "bg-muted-foreground",
};

export function initials(first?: string | null, last?: string | null): string {
  const a = (first ?? "").trim()[0] ?? "";
  const b = (last ?? "").trim()[0] ?? "";
  return (a + b).toUpperCase() || "?";
}

export function computeVertical(seller: string | null | undefined): "MP" | "OR" {
  const key = (seller ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return key.includes("LIBERTYSHOESLTD") || key.includes("LIBERTYSHOESLIMITED") ? "MP" : "OR";
}
