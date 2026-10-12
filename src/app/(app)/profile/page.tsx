"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { RequireAuth } from "@/components/shared/require-auth";
import { PageHeader } from "@/components/shared/page-header";
import { AvatarCard } from "@/components/profile/avatar-card";
import { EmployeeDetailsCard } from "@/components/profile/employee-details-card";
import { ChangePasswordCard } from "@/components/profile/change-password-card";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/lib/stores/auth-store";
import type { User } from "@/lib/types";

function ProfilePageContent() {
  const setUser = useAuthStore((s) => s.setUser);
  const cachedUser = useAuthStore((s) => s.user);

  const { data, isLoading } = useQuery({
    queryKey: ["me"],
    queryFn: async () => (await apiClient.get<{ user: User }>("/api/auth/me")).data.user,
  });

  useEffect(() => {
    if (data) setUser(data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const user = data ?? cachedUser ?? undefined;
  const stillLoading = isLoading && !cachedUser;

  return (
    <div>
      <PageHeader title="My Profile" description="Your account details and security settings." />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
        <AvatarCard user={user} loading={stillLoading} />
        <div className="space-y-4">
          <EmployeeDetailsCard user={user} loading={stillLoading} />
          <ChangePasswordCard />
        </div>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <RequireAuth>
      <ProfilePageContent />
    </RequireAuth>
  );
}
