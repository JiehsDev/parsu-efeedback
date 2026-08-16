"use client";

import { useActionState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Loader2, Mail } from "lucide-react";
import { forgotPasswordAction, type ActionResult } from "@/features/auth/actions";

const initialState: ActionResult | undefined = undefined;

const inputClass =
  "w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--background)]/40 py-2.5 pl-10 pr-3 text-base text-[var(--foreground)] outline-none transition-colors focus:border-[var(--ring)] focus:ring-1 focus:ring-[var(--ring)] sm:text-sm";

export default function ForgotPasswordPage() {
  const [state, formAction, isPending] = useActionState(forgotPasswordAction, initialState);

  return (
    <main className="w-full max-w-sm">
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-xl shadow-black/20 sm:p-8">
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--foreground)]">
          Forgot password
        </h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          Enter your email and we&apos;ll send you a reset link.
        </p>

        {state?.success ? (
          <div className="mt-8 flex items-start gap-2 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--background)]/40 p-4 text-sm text-[var(--foreground)]">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--primary)]" />
            <span>{state.message}</span>
          </div>
        ) : (
          <form action={formAction} className="mt-8 space-y-4" noValidate>
            {state && !state.success && (
              <div
                role="alert"
                className="rounded-[var(--radius)] border border-[var(--destructive)]/40 bg-[var(--destructive)]/10 px-3 py-2.5 text-sm text-[var(--destructive)]"
              >
                {state.message}
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
                  className={inputClass}
                />
              </div>
              {state?.fieldErrors?.email?.map((message) => (
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
              {isPending ? "Sending…" : "Send reset link"}
            </button>
          </form>
        )}
      </div>

      <p className="mt-6 text-center text-sm text-[var(--muted-foreground)]">
        <Link
          href="/login"
          className="inline-flex items-center gap-1 font-medium text-[var(--primary)] hover:underline"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to sign in
        </Link>
      </p>
    </main>
  );
}
