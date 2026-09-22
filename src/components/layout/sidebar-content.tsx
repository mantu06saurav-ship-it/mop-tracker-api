"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NAV_SECTIONS, canView } from "@/lib/nav-config";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useDashboard } from "@/lib/hooks/use-dashboard";
import { initials } from "@/lib/format";
import { API_URL } from "@/lib/api-client";
import { useRouter } from "next/navigation";

export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const { data } = useDashboard({ enabled: !!user });
  const belowMop = data?.summary.below_mop ?? 0;

  const showOperations = user && canView(["Super Admin", "Manager"], user.Role);

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-2 px-5 py-5">
        <div className="flex size-9 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground">
          <TrendingUp className="size-5" />
        </div>
        <div>
          <p className="text-sm font-semibold leading-tight">MOP Tracker</p>
          <p className="text-xs text-sidebar-foreground/60 leading-tight">Compliance Console</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        {NAV_SECTIONS.map((section, i) => {
          const items = section.items.filter((item) =>
            user ? canView(item.roles, user.Role) : item.href === "/catalog"
          );
          if (items.length === 0) return null;
          return (
            <div key={i} className="mb-4">
              {section.label && (
                <p className="px-3 pb-1.5 pt-3 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/45">
                  {section.label}
                </p>
              )}
              <div className="space-y-0.5">
                {items.map((item) => {
                  const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href + "/"));
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onNavigate}
                      className={cn(
                        "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                        active
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                      )}
                    >
                      <Icon className="size-4 shrink-0" />
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.badge === "below-mop" && belowMop > 0 && (
                        <Badge variant="destructive" className="h-5 min-w-5 justify-center rounded-full px-1.5 text-[10px]">
                          {belowMop}
                        </Badge>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}

        {showOperations && (
          <div className="mx-3 mt-2 rounded-lg border border-sidebar-border bg-sidebar-accent/40 p-3 text-xs text-sidebar-foreground/70">
            <p className="font-medium text-sidebar-foreground/90 mb-1">Auto-scrape schedule</p>
            <p>Runs 4×/day — 00:00, 06:00, 12:00, 18:00 IST across all marketplaces.</p>
          </div>
        )}
      </nav>

      {user && (
        <div className="border-t border-sidebar-border p-3">
          <div className="flex items-center gap-2.5 rounded-lg px-2 py-2">
            <Avatar className="size-8">
              <AvatarImage src={user.ProfileImageUrl ? `${API_URL}${user.ProfileImageUrl}` : undefined} />
              <AvatarFallback className="text-xs">{initials(user.FirstName, user.LastName)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {user.FirstName} {user.LastName ?? ""}
              </p>
              <p className="truncate text-xs text-sidebar-foreground/60">{user.Role}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-sidebar-foreground/60 hover:text-sidebar-foreground"
              aria-label="Log out"
              onClick={() => {
                logout();
                router.replace("/login");
              }}
            >
              <LogOut className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
