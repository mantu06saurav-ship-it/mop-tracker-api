"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, Loader2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useUploadAvatar } from "@/lib/hooks/use-auth";
import { useAuthStore } from "@/lib/stores/auth-store";
import { API_URL, apiErrorMessage } from "@/lib/api-client";
import { initials } from "@/lib/format";
import type { User } from "@/lib/types";

const MAX_SIZE = 3 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

export function AvatarCard({ user, loading }: { user: User | undefined; loading: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadMutation = useUploadAvatar();
  const setUser = useAuthStore((s) => s.setUser);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError("Please upload a PNG, JPEG, WEBP, or GIF image.");
      return;
    }
    if (file.size > MAX_SIZE) {
      setError("Image must be 3MB or smaller.");
      return;
    }

    try {
      const { user: updated } = await uploadMutation.mutateAsync(file);
      setUser(updated);
      toast.success("Profile photo updated");
    } catch (err) {
      const message = apiErrorMessage(err, "Could not upload photo.");
      setError(message);
      toast.error(message);
    }
  }

  if (loading || !user) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-8">
          <Skeleton className="size-24 rounded-full" />
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-40" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
        <Avatar className="size-24">
          {user.ProfileImageUrl && <AvatarImage src={`${API_URL}${user.ProfileImageUrl}`} alt="" />}
          <AvatarFallback className="text-2xl">{initials(user.FirstName, user.LastName)}</AvatarFallback>
        </Avatar>
        <div>
          <p className="text-lg font-semibold">
            {user.FirstName} {user.LastName ?? ""}
          </p>
          <p className="text-sm text-muted-foreground">{user.Email}</p>
        </div>
        <Badge variant="outline">{user.Role}</Badge>

        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          onChange={handleFile}
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={uploadMutation.isPending}
        >
          {uploadMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
          Change photo
        </Button>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
