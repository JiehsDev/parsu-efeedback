"use client";

import { use, useActionState } from "react";
import Link from "next/link";
import { resetPasswordAction, type ActionResult } from "@/features/auth/actions";

const initialState: ActionResult | undefined = undefined;

const inputClass =
  "w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--ring)] focus:ring-1 focus:ring-[var(--ring)]";

export default function ResetPasswordPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const [state, formAction, isPending] = useActionState(
    resetPasswordAction,
    initialState,
  );

  return (
    <main className="flex min-h-full flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold text-[var(--foreground)]">
          Reset password
        </h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          Choose a new password for your account.
        </p>

        {state?.success ? (
          <div className="mt-8 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-4 text-sm text-[var(--foreground)]">
            <p>{state.message}</p>
            <Link href="/login" className="mt-3 inline-block text-[var(--primary)] hover:underline">
              Go to sign in →
            </Link>
          </div>
        ) : (
          <form action={formAction} className="mt-8 space-y-4" noValidate>
            <input type="hidden" name="token" value={token} />

            {state && !state.success && (
              <div
                role="alert"
                className="rounded-[var(--radius)] border border-[var(--destructive)]/40 bg-[var(--destructive)]/10 px-3 py-2 text-sm text-[var(--destructive)]"
              >
                {state.message}
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="password" className="text-sm font-medium text-[var(--foreground)]">
                New password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                className={inputClass}
              />
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
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                className={inputClass}
              />
              {state?.fieldErrors?.confirmPassword?.map((message) => (
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
              {isPending ? "Updating…" : "Update password"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
