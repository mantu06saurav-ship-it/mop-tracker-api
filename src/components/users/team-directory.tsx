"use client";

import { useMemo, useState } from "react";
import { Pencil, RotateCcw, Search, Users as UsersIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BoolBadge } from "@/components/shared/status-badge";
import { EditUserDialog } from "@/components/users/edit-user-dialog";
import { API_URL } from "@/lib/api-client";
import { initials, timeAgo } from "@/lib/format";
import type { User, UserRole } from "@/lib/types";

const ROLE_FILTERS: Array<UserRole | "all"> = ["all", "Super Admin", "Manager", "Viewer"];

export function TeamDirectory({ users }: { users: User[] }) {
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<UserRole | "all">("all");
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (role !== "all" && u.Role !== role) return false;
      if (status === "active" && !u.IsActive) return false;
      if (status === "inactive" && u.IsActive) return false;
      if (!q) return true;
      const haystack = [u.FirstName, u.LastName, u.Email, u.EmployeeCode, u.Department]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [users, search, role, status]);

  const hasFilters = search.trim() !== "" || role !== "all" || status !== "all";

  function resetFilters() {
    setSearch("");
    setRole("all");
    setStatus("all");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, employee code, department…"
            className="pl-8"
          />
        </div>
        <Select value={role} onValueChange={(v) => setRole(v as UserRole | "all")}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ROLE_FILTERS.map((r) => (
              <SelectItem key={r} value={r}>
                {r === "all" ? "All Roles" : r}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={(v) => setStatus(v as "all" | "active" | "inactive")}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={resetFilters} disabled={!hasFilters}>
          <RotateCcw className="size-4" />
          Reset filters
        </Button>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed py-16 text-center">
          <UsersIcon className="size-8 text-muted-foreground" />
          {users.length === 0 ? (
            <>
              <p className="font-medium">Your team starts here</p>
              <p className="text-sm text-muted-foreground">Add your first team member to get started.</p>
            </>
          ) : (
            <>
              <p className="font-medium">No matching team members</p>
              <p className="text-sm text-muted-foreground">Try adjusting your search or filters.</p>
            </>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Employee Code</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Designation</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Login</TableHead>
                <TableHead className="text-right">Edit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((u) => (
                <TableRow key={u.UserId}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar>
                        {u.ProfileImageUrl && <AvatarImage src={`${API_URL}${u.ProfileImageUrl}`} alt="" />}
                        <AvatarFallback>{initials(u.FirstName, u.LastName)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {u.FirstName} {u.LastName ?? ""}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">{u.Email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{u.EmployeeCode}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{u.Role}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{u.Department || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{u.Designation || "—"}</TableCell>
                  <TableCell>
                    <BoolBadge ok={u.IsActive} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">{timeAgo(u.LastLogin)}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon-sm" onClick={() => setSelectedUser(u)} aria-label="Edit user">
                      <Pencil className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <EditUserDialog user={selectedUser} users={users} onClose={() => setSelectedUser(null)} />
    </div>
  );
}
