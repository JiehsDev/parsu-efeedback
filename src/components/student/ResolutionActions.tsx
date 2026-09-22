// src/components/student/ResolutionActions.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles, Star } from "lucide-react";
import { useConfirm } from "@/components/shared/ConfirmDialog";
import { useToast } from "@/components/shared/Toast";
import { RatingForm } from "@/components/student/RatingForm";

export function ResolutionActions({ complaintId }: { complaintId: string }) {
  const router = useRouter();
  const confirm = useConfirm();
  const { show: showToast } = useToast();
  const [showRatingForm, setShowRatingForm] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  async function handleCloseWithoutRating() {
    const ok = await confirm({
      title: "Close this complaint without submitting a rating?",
      message:
        "You can close the complaint without providing feedback. Once closed, normal complaint processing will end.",
      confirmLabel: "Close Complaint",
    });
    if (!ok) return;

    setIsClosing(true);
    const res = await fetch(`/api/complaints/${complaintId}/close-without-rating`, {
      method: "POST",
    });
    setIsClosing(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      showToast(data.error ?? "Could not close complaint.");
      return;
    }

    showToast("Complaint closed.");
    router.refresh();
  }

  if (showRatingForm) {
    return <RatingForm complaintId={complaintId} />;
  }

  return (
    <section
      className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5"
      aria-labelledby="resolution-completed-heading"
    >
      <h2 id="resolution-completed-heading" className="text-base font-semibold text-emerald-700 dark:text-emerald-300">
        Resolution Completed
      </h2>
      <p className="mt-1 text-sm text-emerald-800/80 dark:text-emerald-200/80">
        The responsible office has marked your complaint as resolved. You may rate the resolution,
        or close the complaint without submitting a rating.
      </p>
      <div className="mt-4 flex flex-wrap gap-2.5">
        <button
          type="button"
          onClick={() => setShowRatingForm(true)}
          className="inline-flex items-center gap-1.5 rounded-full bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-[var(--primary-foreground)] transition-opacity hover:opacity-90"
        >
          <Sparkles className="h-4 w-4" />
          Rate Resolution
        </button>
        <button
          type="button"
          onClick={handleCloseWithoutRating}
          disabled={isClosing}
          className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] px-4 py-2.5 text-sm font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--muted)] disabled:opacity-50"
        >
          {isClosing && <Loader2 className="h-4 w-4 animate-spin" />}
          Close Without Rating
        </button>
      </div>
    </section>
  );
}

export function ClosedResolutionSummary({
  closureType,
  studentRating,
  studentRatingComment,
}: {
  closureType: "rated" | "without_rating" | null;
  studentRating: number | null;
  studentRatingComment: string;
}) {
  if (closureType === "without_rating") {
    return (
      <section
        className="rounded-2xl border border-[var(--border)] bg-[var(--muted)]/35 p-5"
        aria-labelledby="complaint-closed-heading"
      >
        <h2 id="complaint-closed-heading" className="text-base font-semibold text-[var(--foreground)]">
          Complaint Closed
        </h2>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          You closed this complaint without submitting a rating.
        </p>
      </section>
    );
  }

  return (
    <section
      className="rounded-2xl border border-[var(--border)] bg-[var(--muted)]/35 p-5"
      aria-labelledby="complaint-closed-heading"
    >
      <h2 id="complaint-closed-heading" className="text-base font-semibold text-[var(--foreground)]">
        Complaint Closed
      </h2>
      <p className="mt-1 text-sm text-[var(--muted-foreground)]">
        Your resolution rating was submitted and this complaint is now closed.
      </p>
      {studentRating !== null && (
        <div className="mt-3 flex gap-0.5">
          {[1, 2, 3, 4, 5].map((star) => (
            <Star
              key={star}
              className={`h-5 w-5 ${
                star <= studentRating
                  ? "fill-[var(--primary)] text-[var(--primary)]"
                  : "text-[var(--border)]"
              }`}
            />
          ))}
        </div>
      )}
      {studentRatingComment && (
        <p className="mt-2 text-xs leading-relaxed text-[var(--muted-foreground)]">{studentRatingComment}</p>
      )}
    </section>
  );
}
