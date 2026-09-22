// src/components/student/FeedbackForm.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertCircle, CheckCircle2, Loader2, Send } from "lucide-react";
import { FEEDBACK_CATEGORIES } from "@/features/feedback/constants";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FieldError, FieldLabel, focusFirstInvalid } from "@/components/ui/form-field";

const MIN_MESSAGE_LENGTH = 10;

// Was a sidebar card holding three quoted examples. As a placeholder it does
// the same teaching job at the moment the student is actually deciding what
// to write, and costs no layout.
const MESSAGE_PLACEHOLDER =
  "e.g. The online enrollment portal times out during peak hours — it usually takes three tries to get through.";

export function FeedbackForm() {
  const router = useRouter();
  const [form, setForm] = useState({ category: "", message: "", isAnonymous: false });
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ category?: string; message?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [justSubmitted, setJustSubmitted] = useState(false);

  const trimmedLength = form.message.trim().length;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    // The form is noValidate, so the browser's own required/minLength never
    // fire — these checks are the only thing standing between the student and
    // a round trip that comes back with a Zod error.
    const nextErrors = {
      ...(!form.category ? { category: "Please select a feedback category." } : {}),
      ...(trimmedLength < MIN_MESSAGE_LENGTH
        ? { message: `Feedback message must be at least ${MIN_MESSAGE_LENGTH} characters.` }
        : {}),
    };
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setError("Please correct the highlighted fields below.");
      const formElement = event.currentTarget;
      requestAnimationFrame(() => focusFirstInvalid(formElement));
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(
          typeof data.error === "string"
            ? data.error
            : (data.errors?.[0]?.message ?? "Could not submit feedback."),
        );
        setIsSubmitting(false);
        return;
      }

      setForm({ category: "", message: "", isAnonymous: false });
      setJustSubmitted(true);
      setIsSubmitting(false);
      // Re-runs the page's server component so the "Feedback you've sent"
      // list below picks up the row that was just created.
      router.refresh();
    } catch {
      setError("Could not reach the server. Please try again.");
      setIsSubmitting(false);
    }
  }

  if (justSubmitted) {
    return (
      <div className="rounded-xl border border-[var(--qa-success)]/30 bg-[var(--qa-success-soft)] px-5 py-6 text-center">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--card)] text-[var(--qa-success-strong)]">
          <CheckCircle2 className="h-4 w-4" />
        </span>
        <p className="mt-3 text-sm font-medium text-[var(--qa-success-strong)]">
          Feedback sent to Quality Assurance
        </p>
        <p className="mt-1 text-sm text-[var(--qa-success-strong)]/80">
          There is no ticket to track — QA reviews feedback in batches when looking for patterns.
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
          <button
            type="button"
            onClick={() => setJustSubmitted(false)}
            className="rounded-lg bg-[var(--primary)] px-3.5 py-2 text-sm font-medium text-[var(--primary-foreground)] transition-opacity hover:opacity-90"
          >
            Share more feedback
          </button>
          <Link
            href="/student/dashboard"
            className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-3.5 py-2 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--muted)]"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        {error && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-[var(--destructive)]/40 bg-[var(--destructive)]/10 px-3 py-2.5 text-sm text-[var(--destructive)]"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-1.5">
          <FieldLabel htmlFor="category" required>
            Category
          </FieldLabel>
          {/* The decorative Tag/MessageSquareText icons that used to sit inside
              these fields are gone. Input adornments earn their keep on a
              search box; on a labelled select they are noise, and on a textarea
              the matching pl-10 indented every single line. */}
          <Select
            value={form.category}
            onValueChange={(value) => setForm((p) => ({ ...p, category: value }))}
          >
            <SelectTrigger
              id="category"
              aria-invalid={!!fieldErrors.category}
              aria-describedby="feedback-category-error"
              className="w-full"
            >
              <SelectValue placeholder="Choose a category" />
            </SelectTrigger>
            <SelectContent>
              {FEEDBACK_CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldError id="feedback-category-error" message={fieldErrors.category} />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between gap-3">
            <FieldLabel htmlFor="message" required>
              Message
            </FieldLabel>
            <span
              className={`qa-tabular text-xs ${
                trimmedLength > 0 && trimmedLength < MIN_MESSAGE_LENGTH
                  ? "text-[var(--qa-amber-strong)]"
                  : "text-[var(--muted-foreground)]"
              }`}
            >
              {trimmedLength < MIN_MESSAGE_LENGTH
                ? `${MIN_MESSAGE_LENGTH - trimmedLength} more characters needed`
                : `${trimmedLength} characters`}
            </span>
          </div>
          <textarea
            id="message"
            rows={7}
            value={form.message}
            onChange={(e) => {
              setForm((p) => ({ ...p, message: e.target.value }));
              if (e.target.value.trim().length >= MIN_MESSAGE_LENGTH)
                setFieldErrors((p) => ({ ...p, message: undefined }));
            }}
            aria-invalid={!!fieldErrors.message}
            aria-describedby="feedback-message-error"
            placeholder={MESSAGE_PLACEHOLDER}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-sm leading-relaxed text-[var(--foreground)] transition-colors outline-none placeholder:text-[var(--muted-foreground)]/70 focus:border-[var(--ring)] focus:ring-1 focus:ring-[var(--ring)]"
          />
          <FieldError id="feedback-message-error" message={fieldErrors.message} />
        </div>

        <div className="rounded-lg border border-[var(--border)] bg-[var(--muted)]/40 px-3.5 py-3">
          <label className="flex cursor-pointer items-center gap-2.5 text-sm font-medium text-[var(--foreground)]">
            <input
              type="checkbox"
              checked={form.isAnonymous}
              onChange={(e) => setForm((p) => ({ ...p, isAnonymous: e.target.checked }))}
              className="h-4 w-4 rounded border-[var(--border)] accent-[var(--primary)]"
            />
            Submit anonymously
          </label>
          {/* Deliberately narrower than the old claim, which said not even QA
              staff could trace it back. QA's list does hide the name on
              anonymous rows, but Feedback.studentRef is required and stored
              either way — so the honest promise is about who sees it, not
              about the record not existing. */}
          <p className="mt-1.5 text-xs leading-relaxed text-[var(--muted-foreground)]">
            Your name will not be shown to Quality Assurance staff. The submission is still linked
            to your account in the system&rsquo;s records.
          </p>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-3 py-2.5 text-sm font-medium text-[var(--primary-foreground)] transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          {isSubmitting ? "Sending…" : "Send Feedback"}
        </button>
      </form>
    </div>
  );
}
