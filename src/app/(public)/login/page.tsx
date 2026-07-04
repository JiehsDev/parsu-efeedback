"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";

// Maps the CredentialsSignin `code` values thrown in src/lib/auth.ts to
// copy a person can actually act on.
const ERROR_MESSAGES: Record<string, string> = {
  invalid_credentials: "Invalid email or password.",
  account_locked:
    "Too many failed attempts. This account is temporarily locked — try again shortly.",
  account_inactive: "This account has been deactivated. Contact your administrator.",
  rate_limited: "Too many login attempts. Please wait a moment and try again.",
};

export default function LoginPage() {
  const searchParams = useSearchParams();

  // Best Practice: Redirect to a unified transition route like "/dashboard".
  // Your server-side middleware will intercept this route and immediately
  // forward the user to their correct role-specific dashboard.
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
    <main className="flex min-h-full flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold text-[var(--foreground)]">Sign in</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">ParSU e-Feedback</p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4" noValidate>
          {error && (
            <div
              role="alert"
              className="rounded-[var(--radius)] border border-[var(--destructive)]/40 bg-[var(--destructive)]/10 px-3 py-2 text-sm text-[var(--destructive)]"
            >
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="email" className="text-sm font-medium text-[var(--foreground)]">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--ring)] focus:ring-1 focus:ring-[var(--ring)]"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="password" className="text-sm font-medium text-[var(--foreground)]">
                Password
              </label>
              <Link
                href="/forgot-password"
                className="text-xs text-[var(--primary)] hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--ring)] focus:ring-1 focus:ring-[var(--ring)]"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-[var(--radius)] bg-[var(--primary)] px-3 py-2 text-sm font-medium text-[var(--primary-foreground)] transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {isSubmitting ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-[var(--muted-foreground)]">
          Student?{" "}
          <Link href="/register" className="text-[var(--primary)] hover:underline">
            Create an account
          </Link>
        </p>
      </div>
    </main>
  );
}
