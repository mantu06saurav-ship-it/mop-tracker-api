"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { SidebarContent } from "@/components/layout/sidebar-content";
import { ThemeToggle } from "@/components/shared/theme-toggle";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      <aside className="hidden md:flex md:w-64 md:shrink-0 md:flex-col md:border-r md:border-sidebar-border">
        <div className="fixed h-screen w-64 border-r border-sidebar-border bg-sidebar shadow-[inset_-1px_0_0_rgba(255,255,255,0.04)]">
          <SidebarContent />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border/80 bg-background/80 px-4 backdrop-blur-xl md:hidden">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)} aria-label="Open menu" className="shadow-none">
              <Menu className="size-5" />
            </Button>
            <SheetContent side="left" className="w-72 border-r-0 bg-sidebar p-0 text-sidebar-foreground">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <SidebarContent onNavigate={() => setMobileOpen(false)} />
            </SheetContent>
          </Sheet>
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
              <span className="text-xs font-bold">M</span>
            </div>
            <span className="text-sm font-semibold tracking-tight">MOP Tracker</span>
          </div>
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </header>

        <main className="flex-1 px-4 py-5 sm:px-5 md:px-6 md:py-6 xl:px-8">
          <div className="mx-auto w-full max-w-[1500px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
