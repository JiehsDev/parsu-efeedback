"use client";

import Link from "next/link";
import { useState } from "react";
import { CheckCircle2, Loader2, MailCheck } from "lucide-react";
import { clientFetch } from "@/lib/client-fetch";

export function EmailChangeConfirmation({ token }: { token: string }) {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function confirmEmail() {
    setError(null);
    setIsSubmitting(true);
    try {
      const response = await clientFetch("/api/me/email-change/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(typeof data.error === "string" ? data.error : "Could not confirm this email.");
        return;
      }
      setMessage(data.message);
    } catch {
      setError("Could not confirm this email. Check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="w-full max-w-sm">
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-xl shadow-black/20 sm:p-8">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--primary)]/15 text-[var(--primary)]">
          {message ? <CheckCircle2 className="h-5 w-5" /> : <MailCheck className="h-5 w-5" />}
        </span>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-[var(--foreground)]">
          {message ? "Email address confirmed" : "Confirm your new email"}
        </h1>
        <p className="mt-2 text-sm text-[var(--muted-foreground)]">
          {message ?? "Confirm this address to update the email used to sign in to your account."}
        </p>

        {error && (
          <p
            role="alert"
            className="mt-4 rounded-lg border border-[var(--destructive)]/40 bg-[var(--destructive)]/10 p-3 text-sm text-[var(--destructive)]"
          >
            {error}
          </p>
        )}

        {message ? (
          <Link
            href="/login"
            className="mt-6 inline-flex rounded-lg bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-[var(--primary-foreground)]"
          >
            Go to sign in
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => void confirmEmail()}
            disabled={isSubmitting}
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-[var(--primary-foreground)] disabled:opacity-50"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {isSubmitting ? "Confirming…" : "Confirm email address"}
          </button>
        )}
      </div>
    </main>
  );
}
