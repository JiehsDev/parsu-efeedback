"use client";

import { useActionState } from "react";
import Link from "next/link";
import { forgotPasswordAction, type ActionResult } from "@/features/auth/actions";

const initialState: ActionResult | undefined = undefined;

export default function ForgotPasswordPage() {
  const [state, formAction, isPending] = useActionState(
    forgotPasswordAction,
    initialState,
  );

  return (
    <main className="flex min-h-full flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold text-[var(--foreground)]">
          Forgot password
        </h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          Enter your email and we&apos;ll send you a reset link.
        </p>

        {state?.success ? (
          <div className="mt-8 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-4 text-sm text-[var(--foreground)]">
            {state.message}
          </div>
        ) : (
          <form action={formAction} className="mt-8 space-y-4" noValidate>
            {state && !state.success && (
              <div
                role="alert"
                className="rounded-[var(--radius)] border border-[var(--destructive)]/40 bg-[var(--destructive)]/10 px-3 py-2 text-sm text-[var(--destructive)]"
              >
                {state.message}
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
                className="w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--ring)] focus:ring-1 focus:ring-[var(--ring)]"
              />
              {state?.fieldErrors?.email?.map((message) => (
                <p key={message} className="text-xs text-[var(--destructive)]">
                  {message}
                </p>
              ))}
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="w-full rounded-[var(--radius)] bg-[var(--primary)] px-3 py-2 text-sm font-medium text-[var(--primary-foreground)] transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {isPending ? "Sending…" : "Send reset link"}
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-[var(--muted-foreground)]">
          <Link href="/login" className="text-[var(--primary)] hover:underline">
            ← Back to sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
