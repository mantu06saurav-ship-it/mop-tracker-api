import type { UserRole } from "@/lib/types";
import {
  LayoutDashboard,
  UploadCloud,
  History,
  Database,
  ClipboardCheck,
  Store,
  UserCircle,
  Users,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  roles?: UserRole[];
  badge?: "below-mop";
}

export interface NavSection {
  label?: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    items: [{ href: "/dashboard", label: "MOP Dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Operations",
    items: [
      { href: "/operations", label: "Overview", icon: LayoutDashboard, roles: ["Super Admin", "Manager"], badge: "below-mop" },
      { href: "/operations/upload", label: "Upload & Scrape", icon: UploadCloud, roles: ["Super Admin", "Manager"] },
      { href: "/operations/history", label: "History", icon: History, roles: ["Super Admin"] },
      { href: "/operations/master-data", label: "Master Data Upload", icon: Database, roles: ["Super Admin"] },
    ],
  },
  {
    items: [
      { href: "/audit-report", label: "Audit Report", icon: ClipboardCheck },
      { href: "/catalog", label: "Product Catalog", icon: Store },
      { href: "/profile", label: "My Profile", icon: UserCircle },
      { href: "/users", label: "Manage Users", icon: Users, roles: ["Super Admin"] },
    ],
  },
];

export function canView(roles: UserRole[] | undefined, role: UserRole | undefined): boolean {
  if (!roles) return true;
  if (!role) return false;
  return roles.includes(role);
}
