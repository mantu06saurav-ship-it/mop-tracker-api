"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Loader2, ShieldCheck, TrendingUp, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useLogin } from "@/lib/hooks/use-auth";
import { apiErrorMessage } from "@/lib/api-client";

const schema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});
type FormValues = z.infer<typeof schema>;

const FEATURES = [
  { icon: TrendingUp, text: "Real-time price monitoring across 5 marketplaces" },
  { icon: Zap, text: "Automated below-MOP email alerts, delivered daily" },
  { icon: ShieldCheck, text: "Role-based access for your whole team" },
];

export default function LoginPage() {
  const router = useRouter();
  const { token, hydrate, hydrated, login } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const [keepSignedIn, setKeepSignedIn] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const loginMutation = useLogin();

  useEffect(() => {
    hydrate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (hydrated && token) router.replace("/dashboard");
  }, [hydrated, token, router]);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: FormValues) {
    setErrorMessage(null);
    try {
      const { token: newToken, user } = await loginMutation.mutateAsync(values);
      login(newToken, user, keepSignedIn);
      router.replace("/dashboard");
    } catch (err) {
      setErrorMessage(apiErrorMessage(err, "Could not reach the server."));
    }
  }

  if (!hydrated || token) return null;

  return (
    <div className="grid min-h-screen w-full lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-primary via-primary to-info p-10 text-primary-foreground lg:flex">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(255,255,255,0.15),_transparent_55%)]" />
        <div className="relative flex items-center gap-2">
          <div className="flex size-10 items-center justify-center rounded-xl bg-white/15 backdrop-blur">
            <TrendingUp className="size-5" />
          </div>
          <span className="text-lg font-semibold">MOP Tracker</span>
        </div>

        <div className="relative space-y-6">
          <h1 className="text-4xl font-semibold leading-tight text-balance">
            Marketplace price compliance, watched around the clock.
          </h1>
          <p className="max-w-md text-primary-foreground/80">
            Track MOP breaches, listing accuracy, and seller performance across every marketplace from a
            single console.
          </p>
          <ul className="space-y-3 pt-2">
            {FEATURES.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3 text-sm text-primary-foreground/90">
                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-white/15">
                  <Icon className="size-3.5" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-primary-foreground/60">© {new Date().getFullYear()} Liberty Shoes Limited</p>
      </div>

      <div className="flex flex-col justify-center px-6 py-12 sm:px-12 lg:px-16">
        <div className="mb-8 flex items-center justify-between lg:hidden">
          <div className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <TrendingUp className="size-5" />
            </div>
            <span className="text-base font-semibold">MOP Tracker</span>
          </div>
          <ThemeToggle />
        </div>
        <div className="absolute right-8 top-8 hidden lg:block">
          <ThemeToggle />
        </div>

        <div className="mx-auto w-full max-w-sm">
          <Card className="border-none shadow-none lg:border lg:shadow-sm">
            <CardContent className="pt-2">
              <div className="mb-6">
                <h2 className="text-2xl font-semibold tracking-tight">Welcome back</h2>
                <p className="mt-1 text-sm text-muted-foreground">Sign in to your MOP Tracker account.</p>
              </div>

              {errorMessage && (
                <Alert variant="destructive" className="mb-4">
                  <AlertDescription>{errorMessage}</AlertDescription>
                </Alert>
              )}

              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" autoComplete="email" placeholder="you@company.com" {...form.register("email")} />
                  {form.formState.errors.email && (
                    <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      placeholder="••••••••"
                      className="pr-10"
                      {...form.register("password")}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      tabIndex={-1}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                  {form.formState.errors.password && (
                    <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Checkbox id="keep-signed-in" checked={keepSignedIn} onCheckedChange={(v) => setKeepSignedIn(!!v)} />
                  <Label htmlFor="keep-signed-in" className="text-sm font-normal text-muted-foreground">
                    Keep me signed in
                  </Label>
                </div>

                <Button type="submit" className="w-full" disabled={loginMutation.isPending}>
                  {loginMutation.isPending && <Loader2 className="size-4 animate-spin" />}
                  Sign in
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
