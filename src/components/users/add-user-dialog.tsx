"use client";

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Copy, KeyRound, Loader2, UserPlus } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useRegisterUser } from "@/lib/hooks/use-auth";
import { apiErrorMessage } from "@/lib/api-client";
import type { User, UserRole } from "@/lib/types";

const ROLES: UserRole[] = ["Super Admin", "Manager", "Viewer"];

const addUserSchema = z.object({
  employeeCode: z.string().min(1, "Employee code is required"),
  email: z.string().email("Enter a valid email address"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().optional(),
  phoneNumber: z.string().optional(),
  role: z.enum(["Super Admin", "Manager", "Viewer"]),
  designation: z.string().min(1, "Designation is required"),
  department: z.string().optional(),
  reportingManagerId: z.string().optional(),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type FormValues = z.infer<typeof addUserSchema>;

function generatePassword(length = 14): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

export function AddUserDialog({ users }: { users: User[] }) {
  const qc = useQueryClient();
  const registerMutation = useRegisterUser();
  const [open, setOpen] = useState(false);
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(addUserSchema),
    defaultValues: {
      employeeCode: "",
      email: "",
      firstName: "",
      lastName: "",
      phoneNumber: "",
      role: "Viewer",
      designation: "",
      department: "",
      reportingManagerId: "none",
      password: "",
    },
  });

  const roleValue = useWatch({ control: form.control, name: "role" });
  const reportingManagerValue = useWatch({ control: form.control, name: "reportingManagerId" });

  function resetAll() {
    form.reset();
    setCreated(null);
  }

  function handleOpenChange(next: boolean) {
    if (!next) {
      if (created) {
        qc.invalidateQueries({ queryKey: ["users"] });
      }
      setOpen(false);
      window.setTimeout(resetAll, 200);
    } else {
      setOpen(true);
    }
  }

  async function onSubmit(values: FormValues) {
    try {
      await registerMutation.mutateAsync({
        employeeCode: values.employeeCode,
        firstName: values.firstName,
        lastName: values.lastName || undefined,
        email: values.email,
        phoneNumber: values.phoneNumber || undefined,
        password: values.password,
        role: values.role,
        designation: values.designation,
        department: values.department || undefined,
        reportingManagerId:
          values.reportingManagerId && values.reportingManagerId !== "none"
            ? Number(values.reportingManagerId)
            : undefined,
      });
      setCreated({ email: values.email, password: values.password });
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not create user."));
    }
  }

  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied`);
    } catch {
      toast.error(`Could not copy ${label.toLowerCase()}.`);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <Button onClick={() => setOpen(true)}>
        <UserPlus className="size-4" />
        Add User
      </Button>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        {created ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <span className="flex size-8 items-center justify-center rounded-full bg-success/15 text-success-foreground">
                  <Check className="size-4" />
                </span>
                User created
              </DialogTitle>
              <DialogDescription>
                Share these credentials with the new team member securely.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Email</Label>
                <div className="flex items-center gap-2">
                  <Input readOnly value={created.email} className="font-mono text-xs" />
                  <Button type="button" variant="outline" size="icon" onClick={() => copy(created.email, "Email")}>
                    <Copy className="size-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Temporary password</Label>
                <div className="flex items-center gap-2">
                  <Input readOnly value={created.password} className="font-mono text-xs" />
                  <Button type="button" variant="outline" size="icon" onClick={() => copy(created.password, "Password")}>
                    <Copy className="size-4" />
                  </Button>
                </div>
              </div>
              <Alert>
                <AlertDescription>
                  This password is shown only once — make sure to share it securely. It will not be
                  retrievable after you close this dialog.
                </AlertDescription>
              </Alert>
            </div>

            <DialogFooter>
              <Button onClick={() => handleOpenChange(false)}>Done</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Add User</DialogTitle>
              <DialogDescription>Create a new team member account.</DialogDescription>
            </DialogHeader>

            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="employeeCode">Employee Code *</Label>
                  <Input id="employeeCode" {...form.register("employeeCode")} />
                  {form.formState.errors.employeeCode && (
                    <p className="text-xs text-destructive">{form.formState.errors.employeeCode.message}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email *</Label>
                  <Input id="email" type="email" {...form.register("email")} />
                  {form.formState.errors.email && (
                    <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="firstName">First Name *</Label>
                  <Input id="firstName" {...form.register("firstName")} />
                  {form.formState.errors.firstName && (
                    <p className="text-xs text-destructive">{form.formState.errors.firstName.message}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input id="lastName" {...form.register("lastName")} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="phoneNumber">Phone</Label>
                  <Input id="phoneNumber" {...form.register("phoneNumber")} />
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
                  <Label htmlFor="designation">Designation *</Label>
                  <Input id="designation" {...form.register("designation")} />
                  {form.formState.errors.designation && (
                    <p className="text-xs text-destructive">{form.formState.errors.designation.message}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="department">Department</Label>
                  <Input id="department" {...form.register("department")} />
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
                      {users.map((u) => (
                        <SelectItem key={u.UserId} value={String(u.UserId)}>
                          {u.FirstName} {u.LastName ?? ""} ({u.EmployeeCode})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="password">Temporary Password *</Label>
                  <div className="flex items-center gap-2">
                    <Input id="password" type="text" className="font-mono text-xs" {...form.register("password")} />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => form.setValue("password", generatePassword(), { shouldValidate: true })}
                    >
                      <KeyRound className="size-4" />
                      Generate
                    </Button>
                  </div>
                  {form.formState.errors.password && (
                    <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>
                  )}
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={registerMutation.isPending}>
                  {registerMutation.isPending && <Loader2 className="size-4 animate-spin" />}
                  Create User
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
