"use client";

import { IdCard } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/format";
import type { User } from "@/lib/types";

export function EmployeeDetailsCard({ user, loading }: { user: User | undefined; loading: boolean }) {
  const rows: Array<[string, string]> = user
    ? [
        ["Full Name", `${user.FirstName} ${user.LastName ?? ""}`.trim()],
        ["Employee Code", user.EmployeeCode],
        ["Email", user.Email],
        ["Phone", user.PhoneNumber || "—"],
        ["Role", user.Role],
        ["Department", user.Department || "—"],
        ["Designation", user.Designation],
        ["Last Login", formatDate(user.LastLogin)],
      ]
    : [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <IdCard className="size-4" />
          Employee Details
        </CardTitle>
        <CardDescription>Managed by your administrator — request changes via Manage Users.</CardDescription>
      </CardHeader>
      <CardContent>
        {loading || !user ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-4 w-32" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {rows.map(([label, value]) => (
              <div key={label}>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-sm font-medium">{value}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
