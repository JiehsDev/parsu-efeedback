// src/components/student/RatingForm.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2, Sparkles, Star } from "lucide-react";
import { useToast } from "@/components/shared/Toast";

export function RatingForm({ complaintId }: { complaintId: string }) {
  const router = useRouter();
  const { show: showToast } = useToast();
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (rating === 0) {
      setError("Please select a rating.");
      return;
    }
    setError(null);
    setIsSubmitting(true);

    const res = await fetch(`/api/complaints/${complaintId}/rate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentRating: rating, studentRatingComment: comment }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Could not submit rating.");
      setIsSubmitting(false);
      return;
    }

    showToast("Thanks for your feedback!");
    router.refresh();
  }

  const activeRating = hoverRating || rating;

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-xl shadow-black/20"
    >
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--primary)]/15 text-[var(--primary)]">
          <Sparkles className="h-[18px] w-[18px]" />
        </span>
        <div>
          <p className="text-sm font-medium text-[var(--foreground)]">Rate this resolution</p>
          <p className="text-xs text-[var(--muted-foreground)]">
            Your feedback helps improve response quality.
          </p>
        </div>
      </div>

      {error && (
        <div className="mt-3 flex items-start gap-2 rounded-2xl border border-[var(--destructive)]/40 bg-[var(--destructive)]/10 px-3 py-2 text-sm text-[var(--destructive)]">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div
        className="mt-4 flex gap-1"
        onMouseLeave={() => setHoverRating(0)}
        role="radiogroup"
        aria-label="Rating"
      >
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => setRating(star)}
            onMouseEnter={() => setHoverRating(star)}
            aria-label={`Rate ${star} star${star > 1 ? "s" : ""}`}
            className="transition-transform hover:scale-110"
          >
            <Star
              className={`h-8 w-8 transition-colors ${
                star <= activeRating
                  ? "fill-[var(--primary)] text-[var(--primary)]"
                  : "text-[var(--border)]"
              }`}
            />
          </button>
        ))}
      </div>

      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Optional comment"
        rows={3}
        className="mt-4 w-full rounded-2xl border border-[var(--border)] bg-[var(--background)]/40 px-3 py-2.5 text-sm text-[var(--foreground)] outline-none transition-colors focus:border-[var(--ring)] focus:ring-1 focus:ring-[var(--ring)]"
      />

      <button
        type="submit"
        disabled={isSubmitting}
        className="mt-4 flex items-center gap-2 rounded-full bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-[var(--primary-foreground)] transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
        {isSubmitting ? "Submitting…" : "Submit Rating"}
      </button>
    </form>
  );
}
