"use client";

import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUpdateUser } from "@/lib/hooks/use-users";
import { apiErrorMessage } from "@/lib/api-client";
import type { User, UserRole } from "@/lib/types";

const ROLES: UserRole[] = ["Super Admin", "Manager", "Viewer"];

const editUserSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().optional(),
  phoneNumber: z.string().optional(),
  role: z.enum(["Super Admin", "Manager", "Viewer"]),
  designation: z.string().min(1, "Designation is required"),
  department: z.string().optional(),
  reportingManagerId: z.string().optional(),
  isActive: z.boolean(),
});

type FormValues = z.infer<typeof editUserSchema>;

function EditUserForm({ user, users, onDone }: { user: User; users: User[]; onDone: () => void }) {
  const updateMutation = useUpdateUser();
  const form = useForm<FormValues>({
    resolver: zodResolver(editUserSchema),
    defaultValues: {
      firstName: user.FirstName,
      lastName: user.LastName ?? "",
      phoneNumber: user.PhoneNumber ?? "",
      role: user.Role,
      designation: user.Designation,
      department: user.Department ?? "",
      reportingManagerId: user.ReportingManagerId ? String(user.ReportingManagerId) : "none",
      isActive: user.IsActive,
    },
  });

  async function onSubmit(values: FormValues) {
    try {
      await updateMutation.mutateAsync({
        id: user.UserId,
        payload: {
          firstName: values.firstName,
          lastName: values.lastName || undefined,
          phoneNumber: values.phoneNumber || undefined,
          role: values.role,
          designation: values.designation,
          department: values.department || undefined,
          reportingManagerId:
            values.reportingManagerId && values.reportingManagerId !== "none"
              ? Number(values.reportingManagerId)
              : null,
          isActive: values.isActive,
        },
      });
      toast.success("User updated");
      onDone();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not update user."));
    }
  }

  const managerOptions = users.filter((u) => u.UserId !== user.UserId);
  const isActive = useWatch({ control: form.control, name: "isActive" });
  const roleValue = useWatch({ control: form.control, name: "role" });
  const reportingManagerValue = useWatch({ control: form.control, name: "reportingManagerId" });

  return (
    <>
      <DialogHeader>
        <DialogTitle>Edit User</DialogTitle>
        <DialogDescription>
          Update {user.FirstName} {user.LastName ?? ""}&apos;s account.
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Email</Label>
            <Input value={user.Email} disabled readOnly />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-firstName">First Name *</Label>
            <Input id="edit-firstName" {...form.register("firstName")} />
            {form.formState.errors.firstName && (
              <p className="text-xs text-destructive">{form.formState.errors.firstName.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-lastName">Last Name</Label>
            <Input id="edit-lastName" {...form.register("lastName")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-phoneNumber">Phone</Label>
            <Input id="edit-phoneNumber" {...form.register("phoneNumber")} />
          </div>
          <div className="space-y-1.5">
            <Label>Role *</Label>
            <Select
              value={roleValue}
              onValueChange={(v) => form.setValue("role", v as UserRole, { shouldValidate: true })}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-designation">Designation *</Label>
            <Input id="edit-designation" {...form.register("designation")} />
            {form.formState.errors.designation && (
              <p className="text-xs text-destructive">{form.formState.errors.designation.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-department">Department</Label>
            <Input id="edit-department" {...form.register("department")} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Reporting Manager</Label>
            <Select
              value={reportingManagerValue}
              onValueChange={(v) => form.setValue("reportingManagerId", v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {managerOptions.map((u) => (
                  <SelectItem key={u.UserId} value={String(u.UserId)}>
                    {u.FirstName} {u.LastName ?? ""} ({u.EmployeeCode})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between rounded-lg border px-3 py-2 sm:col-span-2">
            <div>
              <Label htmlFor="edit-isActive">Account status</Label>
              <p className="text-xs text-muted-foreground">{isActive ? "Active — can sign in" : "Inactive — sign-in blocked"}</p>
            </div>
            <Switch
              id="edit-isActive"
              checked={isActive}
              onCheckedChange={(v) => form.setValue("isActive", v)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onDone}>
            Cancel
          </Button>
          <Button type="submit" disabled={updateMutation.isPending}>
            {updateMutation.isPending && <Loader2 className="size-4 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}

export function EditUserDialog({
  user,
  users,
  onClose,
}: {
  user: User | null;
  users: User[];
  onClose: () => void;
}) {
  return (
    <Dialog open={!!user} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        {user && <EditUserForm key={user.UserId} user={user} users={users} onDone={onClose} />}
      </DialogContent>
    </Dialog>
  );
}
