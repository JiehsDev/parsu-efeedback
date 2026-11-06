"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, X } from "lucide-react";
import { clientFetch } from "@/lib/client-fetch";
import { useToast } from "@/components/shared/Toast";

export function ResolutionApprovalPanel({
  request,
  canReview,
}: {
  request: any;
  canReview: boolean;
}) {
  const router = useRouter();
  const { show: showToast } = useToast();
  const [busy, setBusy] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [error, setError] = useState("");
  const pending = request.status === "pending";

  async function decide(action: "approve" | "reject") {
    if (action === "reject" && !rejectionReason.trim()) {
      setError("Add a note explaining what needs to change before returning this request.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await clientFetch(`/api/resolution-requests/${request._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, rejectionReason }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(typeof data.error === "string" ? data.error : "Could not review this request.");
        return;
      }
      showToast(action === "approve" ? "Resolution approved." : "Resolution returned to staff.");
      router.refresh();
    } catch {
      setError("Could not review this request. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
      <h3 className="text-sm font-semibold">
        {pending ? "Resolution awaiting head approval" : `Resolution request ${request.status}`}
      </h3>
      <p className="mt-1 text-xs text-[var(--muted-foreground)]">
        Submitted by {request.requestedByRef?.firstName} {request.requestedByRef?.lastName}
      </p>
      {request.resolutionSummary && (
        <div className="mt-3">
          <p className="text-xs font-semibold text-[var(--muted-foreground)]">Resolution details</p>
          <p className="mt-1 break-words whitespace-pre-wrap text-sm">{request.resolutionSummary}</p>
        </div>
      )}
      {request.message && (
        <div className="mt-3">
          <p className="text-xs font-semibold text-[var(--muted-foreground)]">Message</p>
          <p className="mt-1 break-words whitespace-pre-wrap text-sm">{request.message}</p>
        </div>
      )}
      {request.status === "rejected" && request.rejectionReason && (
        <p className="mt-3 rounded-md bg-[var(--muted)] px-3 py-2 text-sm">
          Head’s note: {request.rejectionReason}
        </p>
      )}
      {canReview && pending && (
        <>
          {error && <p role="alert" className="mt-3 text-sm text-[var(--destructive)]">{error}</p>}
          <label htmlFor={`resolution-rejection-${request._id}`} className="mt-3 block text-xs font-medium">
            Note to staff if returning this request
          </label>
          <textarea
            id={`resolution-rejection-${request._id}`}
            value={rejectionReason}
            onChange={(event) => setRejectionReason(event.target.value)}
            maxLength={2000}
            rows={2}
            disabled={busy}
            placeholder="Explain what needs further work"
            className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => decide("reject")}
              className="flex min-h-10 flex-1 items-center justify-center gap-2 rounded-lg border border-[var(--destructive)]/40 px-3 py-2 text-sm font-medium text-[var(--destructive)] disabled:opacity-50"
            >
              <X className="h-4 w-4" /> Return to staff
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => decide("approve")}
              className="flex min-h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-3 py-2 text-sm font-semibold text-[var(--primary-foreground)] disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Approve resolution
            </button>
          </div>
        </>
      )}
    </section>
  );
}
