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
import { useScrapeSchedule } from "@/lib/hooks/use-scrape-schedule";
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
  const scheduleQuery = useScrapeSchedule(Boolean(showOperations));

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-2.5 px-4 py-4">
        <div className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-sidebar-primary to-sidebar-primary/80 text-sidebar-primary-foreground shadow-sm ring-1 ring-white/10">
          <TrendingUp className="size-4.5" />
        </div>
        <div>
          <p className="text-sm font-bold leading-tight tracking-tight">MOP Tracker</p>
          <p className="text-[11px] leading-tight text-sidebar-foreground/60">Compliance Console</p>
        </div>
      </div>

      <nav className="flex-1 px-3 pb-2">
        {NAV_SECTIONS.map((section, i) => {
          const items = section.items.filter((item) =>
            user ? canView(item.roles, user.Role) : item.href === "/catalog"
          );
          if (items.length === 0) return null;
          return (
            <div key={i} className="mb-3">
              {section.label && (
                <p className="px-3 pb-1 pt-1.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-sidebar-foreground/45">
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
                        "flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-200",
                        active
                          ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]"
                          : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                      )}
                    >
                      <Icon className="size-3.5 shrink-0" />
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.badge === "below-mop" && belowMop > 0 && (
                        <Badge variant="destructive" className="h-5 min-w-5 justify-center rounded-full px-1.5 text-[10px] font-semibold">
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
          <div className="mx-3 mt-2 rounded-xl border border-sidebar-border bg-sidebar-accent/40 p-3 text-xs leading-relaxed text-sidebar-foreground/75">
            <div className="mb-1 flex items-center justify-between gap-2">
              <p className="font-semibold text-sidebar-foreground">Auto-scrape</p>
              {scheduleQuery.data && (
                <Badge variant={scheduleQuery.data.schedule.enabled ? "default" : "secondary"} className="h-4 px-1.5 text-[9px]">
                  {scheduleQuery.data.schedule.enabled ? "Active" : "Paused"}
                </Badge>
              )}
            </div>
            <p>
              {scheduleQuery.isLoading
                ? "Loading schedule…"
                : scheduleQuery.isError
                  ? "Schedule unavailable."
                  : scheduleQuery.data?.schedule.enabled
                    ? `${scheduleQuery.data.schedule.times.slice(0, 3).join(" · ")}${scheduleQuery.data.schedule.times.length > 3 ? " · …" : ""} IST · all marketplaces`
                    : "Automatic runs are paused."}
            </p>
          </div>
        )}
      </nav>

      {user && (
        <div className="border-t border-sidebar-border p-3">
          <div className="flex items-center gap-2.5 rounded-xl border border-white/5 bg-white/3 px-2 py-2.5">
            <Avatar className="size-9 ring-1 ring-white/10">
              <AvatarImage src={user.ProfileImageUrl ? `${API_URL}${user.ProfileImageUrl}` : undefined} />
              <AvatarFallback className="text-xs font-semibold">{initials(user.FirstName, user.LastName)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">
                {user.FirstName} {user.LastName ?? ""}
              </p>
              <p className="truncate text-[11px] text-sidebar-foreground/60">{user.Role}</p>
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
