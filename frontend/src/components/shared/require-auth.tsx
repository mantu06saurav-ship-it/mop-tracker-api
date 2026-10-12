"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuthStore } from "@/lib/stores/auth-store";
import type { UserRole } from "@/lib/types";

export function FullscreenLoader() {
  return (
    <div className="flex h-[60vh] w-full items-center justify-center">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
    </div>
  );
}

export function RequireAuth({ roles, children }: { roles?: UserRole[]; children: React.ReactNode }) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const hydrated = useAuthStore((s) => s.hydrated);

  const allowed = !!user && (!roles || roles.includes(user.Role));

  useEffect(() => {
    if (!hydrated) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (roles && !roles.includes(user.Role)) {
      router.replace("/dashboard");
    }
  }, [hydrated, user, roles, router]);

  if (!hydrated || !allowed) return <FullscreenLoader />;
  return <>{children}</>;
}
