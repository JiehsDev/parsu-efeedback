// src/app/student/feedback/new/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  EyeOff,
  Loader2,
  MessageSquareText,
  Send,
  Sparkles,
  Tag,
} from "lucide-react";
import { FEEDBACK_CATEGORIES } from "@/features/feedback/constants";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const GOOD_FEEDBACK_EXAMPLES = [
  "The online enrollment portal times out during peak hours.",
  "The library extended hours during finals week — please keep it.",
  "Signage near the new admin building is confusing for freshmen.",
];

export default function NewFeedbackPage() {
  const router = useRouter();
  const [form, setForm] = useState({ category: "", message: "", isAnonymous: false });
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!form.category) {
      setError("Please select a category.");
      return;
    }
    setError(null);
    setIsSubmitting(true);

    const res = await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();

    if (!res.ok) {
      const message =
        typeof data.error === "string"
          ? data.error
          : (data.errors?.[0]?.message ?? "Could not submit feedback.");

      setError(message);
      setIsSubmitting(false);
      return;
    }

    router.push("/student/dashboard?feedbackSubmitted=true");
  }

  const inputClass =
    "w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--background)]/40 py-2.5 pl-10 pr-3 text-sm text-[var(--foreground)] outline-none transition-colors focus:border-[var(--ring)] focus:ring-1 focus:ring-[var(--ring)]";

  return (
    <div className="mx-auto max-w-5xl">
      <Link
        href="/student/dashboard"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to dashboard
      </Link>

      <div className="mt-5 flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--primary)]/15 text-[var(--primary)]">
          <MessageSquareText className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[var(--foreground)]">
            Share Feedback
          </h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            General suggestions or observations — not tied to a specific complaint.
          </p>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-xl shadow-black/20 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            {error && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-2xl border border-[var(--destructive)]/40 bg-[var(--destructive)]/10 px-3 py-2.5 text-sm text-[var(--destructive)]"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="category" className="text-sm font-medium text-[var(--foreground)]">
                Category
              </label>
              <div className="relative">
                <Tag className="pointer-events-none absolute top-1/2 left-3 z-10 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
                <Select
                  value={form.category}
                  onValueChange={(value) => setForm((p) => ({ ...p, category: value }))}
                >
                  <SelectTrigger id="category" className="pl-10">
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {FEEDBACK_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="message" className="text-sm font-medium text-[var(--foreground)]">
                Message
              </label>
              <div className="relative">
                <MessageSquareText className="pointer-events-none absolute top-3 left-3 h-4 w-4 text-[var(--muted-foreground)]" />
                <textarea
                  id="message"
                  required
                  minLength={10}
                  rows={8}
                  value={form.message}
                  onChange={(e) => setForm((p) => ({ ...p, message: e.target.value }))}
                  placeholder="Share your thoughts..."
                  className={`${inputClass} py-3`}
                />
              </div>
            </div>

            <label className="flex cursor-pointer items-center gap-2.5 text-sm text-[var(--foreground)]">
              <input
                type="checkbox"
                checked={form.isAnonymous}
                onChange={(e) => setForm((p) => ({ ...p, isAnonymous: e.target.checked }))}
                className="h-4 w-4 rounded border-[var(--border)] accent-[var(--primary)]"
              />
              Submit anonymously
            </label>

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-[var(--primary)] px-3 py-2.5 text-sm font-semibold text-[var(--primary-foreground)] transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {isSubmitting ? "Submitting…" : "Submit Feedback"}
            </button>
          </form>
        </div>

        <div className="space-y-6">
          <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--primary)]/15 text-[var(--primary)]">
                <Sparkles className="h-[18px] w-[18px]" />
              </span>
              <p className="text-sm font-medium text-[var(--foreground)]">Why share feedback?</p>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-[var(--muted-foreground)]">
              Feedback isn't a complaint — it's how the university spots patterns and improves
              services before they become problems. Every submission reaches the Quality Assurance
              office directly.
            </p>
          </div>

          <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
                <EyeOff className="h-[18px] w-[18px]" />
              </span>
              <p className="text-sm font-medium text-[var(--foreground)]">Anonymity, respected</p>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-[var(--muted-foreground)]">
              Check "Submit anonymously" and your name is never attached to this feedback — not even
              QA staff can trace it back to your account.
            </p>
          </div>

          <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5">
            <p className="text-sm font-medium text-[var(--foreground)]">
              Good feedback sounds like
            </p>
            <ul className="mt-3 space-y-2.5">
              {GOOD_FEEDBACK_EXAMPLES.map((example) => (
                <li
                  key={example}
                  className="rounded-xl bg-[var(--muted)]/40 px-3 py-2 text-xs leading-relaxed text-[var(--muted-foreground)] italic"
                >
                  "{example}"
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
