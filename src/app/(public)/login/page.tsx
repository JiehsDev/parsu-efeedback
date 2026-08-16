"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { AlertCircle, Eye, EyeOff, Loader2, Lock, Mail } from "lucide-react";

// Maps the CredentialsSignin `code` values thrown in src/lib/auth.ts to
// copy a person can actually act on.
const ERROR_MESSAGES: Record<string, string> = {
  invalid_credentials: "Invalid email or password.",
  account_locked:
    "Too many failed attempts. This account is temporarily locked — try again shortly.",
  account_inactive: "This account has been deactivated. Contact your administrator.",
  rate_limited: "Too many login attempts. Please wait a moment and try again.",
};

const inputClass =
  "w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--background)]/40 py-2.5 pl-10 pr-3 text-base text-[var(--foreground)] outline-none transition-colors focus:border-[var(--ring)] focus:ring-1 focus:ring-[var(--ring)] sm:text-sm";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const searchParams = useSearchParams();

  // Best Practice: Redirect to a unified transition route like "/dashboard".
  // Your server-side middleware will intercept this route and immediately
  // forward the user to their correct role-specific dashboard.
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fixed: Replaced deprecated FormEvent with modern React 19 safe event modeling
  async function handleSubmit(event: React.BaseSyntheticEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError(ERROR_MESSAGES[result.error] ?? "Something went wrong. Please try again.");
        setIsSubmitting(false);
        return;
      }

      // Safe client-side redirect fallback to let middleware pick up token placement cleanly
      window.location.href = callbackUrl;
    } catch (err) {
      setError("An unexpected system error occurred.");
      setIsSubmitting(false);
    }
  }

  return (
    <main className="w-full max-w-sm">
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-xl shadow-black/20 sm:p-8">
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--foreground)]">
          Welcome back
        </h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          Sign in to your ParSU e-Feedback account
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4" noValidate>
          {error && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-[var(--radius)] border border-[var(--destructive)]/40 bg-[var(--destructive)]/10 px-3 py-2.5 text-sm text-[var(--destructive)]"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="email" className="text-sm font-medium text-[var(--foreground)]">
              Email
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
              <input
                id="email"
                name="email"
                type="email"
                inputMode="email"
                autoCapitalize="none"
                autoCorrect="off"
                autoComplete="email"
                autoFocus
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="password" className="text-sm font-medium text-[var(--foreground)]">
                Password
              </label>
              <Link
                href="/forgot-password"
                className="text-xs font-medium text-[var(--primary)] hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`${inputClass} pr-10`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                tabIndex={-1}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="flex w-full items-center justify-center gap-2 rounded-[var(--radius)] bg-[var(--primary)] px-3 py-2.5 text-sm font-medium text-[var(--primary-foreground)] transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {isSubmitting ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>

      <p className="mt-6 text-center text-sm text-[var(--muted-foreground)]">
        Student?{" "}
        <Link href="/register" className="font-medium text-[var(--primary)] hover:underline">
          Create an account
        </Link>
      </p>
    </main>
  );
}
