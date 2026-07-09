// src/components/student/RatingForm.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function RatingForm({ complaintId }: { complaintId: string }) {
  const router = useRouter();
  const [rating, setRating] = useState(0);
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

    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-4"
    >
      <p className="text-sm font-medium text-[var(--foreground)]">Rate this resolution</p>

      {error && <p className="mt-2 text-sm text-[var(--destructive)]">{error}</p>}

      <div className="mt-3 flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => setRating(star)}
            className={`text-2xl transition-colors ${
              star <= rating ? "text-[var(--primary)]" : "text-[var(--border)]"
            }`}
            aria-label={`Rate ${star} stars`}
          >
            ★
          </button>
        ))}
      </div>

      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Optional comment"
        rows={3}
        className="mt-3 w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--ring)] focus:ring-1 focus:ring-[var(--ring)]"
      />

      <button
        type="submit"
        disabled={isSubmitting}
        className="mt-3 rounded-[var(--radius)] bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {isSubmitting ? "Submitting…" : "Submit Rating"}
      </button>
    </form>
  );
}
