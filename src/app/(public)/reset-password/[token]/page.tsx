"use client";

import { use, useActionState, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Eye, EyeOff, Loader2, Lock } from "lucide-react";
import { resetPasswordAction, type ActionResult } from "@/features/auth/actions";

const initialState: ActionResult | undefined = undefined;

const inputClass =
  "w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--background)]/40 py-2.5 pl-10 pr-10 text-base text-[var(--foreground)] outline-none transition-colors focus:border-[var(--ring)] focus:ring-1 focus:ring-[var(--ring)] sm:text-sm";

export default function ResetPasswordPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [state, formAction, isPending] = useActionState(resetPasswordAction, initialState);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  return (
    <main className="w-full max-w-sm">
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-xl shadow-black/20 sm:p-8">
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--foreground)]">
          Reset password
        </h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          Choose a new password for your account.
        </p>

        {state?.success ? (
          <div className="mt-8 space-y-3">
            <div className="flex items-start gap-2 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--background)]/40 p-4 text-sm text-[var(--foreground)]">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--primary)]" />
              <span>{state.message}</span>
            </div>
            <Link
              href="/login"
              className="inline-block text-sm font-medium text-[var(--primary)] hover:underline"
            >
              Go to sign in →
            </Link>
          </div>
        ) : (
          <form action={formAction} className="mt-8 space-y-4" noValidate>
            <input type="hidden" name="token" value={token} />

            {state && !state.success && (
              <div
                role="alert"
                className="rounded-[var(--radius)] border border-[var(--destructive)]/40 bg-[var(--destructive)]/10 px-3 py-2.5 text-sm text-[var(--destructive)]"
              >
                {state.message}
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="password" className="text-sm font-medium text-[var(--foreground)]">
                New password
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  autoFocus
                  required
                  className={inputClass}
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
              {state?.fieldErrors?.password?.map((message) => (
                <p key={message} className="text-xs text-[var(--destructive)]">
                  {message}
                </p>
              ))}
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="confirmPassword"
                className="text-sm font-medium text-[var(--foreground)]"
              >
                Confirm new password
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  className={inputClass}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((v) => !v)}
                  tabIndex={-1}
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                  className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {state?.fieldErrors?.confirmPassword?.map((message) => (
                <p key={message} className="text-xs text-[var(--destructive)]">
                  {message}
                </p>
              ))}
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="flex w-full items-center justify-center gap-2 rounded-[var(--radius)] bg-[var(--primary)] px-3 py-2.5 text-sm font-medium text-[var(--primary-foreground)] transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {isPending ? "Updating…" : "Update password"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
