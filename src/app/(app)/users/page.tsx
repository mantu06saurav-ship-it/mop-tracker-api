"use client";

import { useMemo } from "react";
import { Mail, ShieldCheck, UserCheck, UserX, Users as UsersIcon } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { RequireAuth } from "@/components/shared/require-auth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AddUserDialog } from "@/components/users/add-user-dialog";
import { TeamDirectory } from "@/components/users/team-directory";
import { EmailAutomation } from "@/components/users/email-automation";
import { useUsers } from "@/lib/hooks/use-users";

function UsersPageContent() {
  const { data: users, isLoading } = useUsers();

  const stats = useMemo(() => {
    const list = users ?? [];
    return {
      total: list.length,
      active: list.filter((u) => u.IsActive).length,
      superAdmins: list.filter((u) => u.Role === "Super Admin").length,
      inactive: list.filter((u) => !u.IsActive).length,
    };
  }, [users]);

  return (
    <div>
      <PageHeader
        title="Manage Users"
        description="Team directory, roles, and daily email automation."
        actions={<AddUserDialog users={users ?? []} />}
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total Members" value={stats.total} icon={UsersIcon} loading={isLoading} />
        <StatCard label="Active Accounts" value={stats.active} icon={UserCheck} tone="success" loading={isLoading} />
        <StatCard label="Super Admins" value={stats.superAdmins} icon={ShieldCheck} tone="info" loading={isLoading} />
        <StatCard label="Inactive Accounts" value={stats.inactive} icon={UserX} tone="danger" loading={isLoading} />
      </div>

      <Tabs defaultValue="directory">
        <TabsList>
          <TabsTrigger value="directory">Team Directory</TabsTrigger>
          <TabsTrigger value="email">
            <Mail className="size-3.5" />
            Email Automation
          </TabsTrigger>
        </TabsList>
        <TabsContent value="directory" className="mt-4">
          <TeamDirectory users={users ?? []} />
        </TabsContent>
        <TabsContent value="email" className="mt-4">
          <EmailAutomation />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function UsersPage() {
  return (
    <RequireAuth roles={["Super Admin"]}>
      <UsersPageContent />
    </RequireAuth>
  );
}
