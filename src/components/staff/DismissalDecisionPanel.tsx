"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { clientFetch } from "@/lib/client-fetch";
import { useToast } from "@/components/shared/Toast";

export function DismissalDecisionPanel({
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
  async function decide(action: "approve" | "reject") {
    if (action === "reject" && !rejectionReason.trim()) {
      showToast("Add a reason for rejection.", "error");
      return;
    }
    setBusy(true);
    try {
      const response = await clientFetch(`/api/dismissal-requests/${request._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, rejectionReason: rejectionReason.trim() }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        showToast(
          typeof data.error === "string" ? data.error : "Could not review request.",
          "error",
        );
        return;
      }
      showToast(action === "approve" ? "Complaint dismissed." : "Dismissal request rejected.");
      router.refresh();
    } catch {
      showToast("Could not review request. Please try again.", "error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-2 rounded-xl border border-[var(--qa-amber)]/40 bg-[var(--qa-amber-soft)] p-3">
      <p className="text-sm font-semibold">Dismissal request pending</p>
      <p className="text-xs">
        Requested by {request.requestedByRef?.firstName} {request.requestedByRef?.lastName}
      </p>
      <p className="text-sm">Reason: {request.reasonCode?.replaceAll("_", " ")}</p>
      <p className="text-sm break-words whitespace-pre-wrap">
        Student explanation: {request.reasonText}
      </p>
      {request.internalNote && (
        <p className="text-sm break-words whitespace-pre-wrap">
          Internal note: {request.internalNote}
        </p>
      )}
      {canReview && (
        <>
          <label
            htmlFor={`dismissal-rejection-${request._id}`}
            className="block text-sm font-medium"
          >
            Reason if rejecting
          </label>
          <textarea
            id={`dismissal-rejection-${request._id}`}
            value={rejectionReason}
            onChange={(event) => setRejectionReason(event.target.value)}
            maxLength={2000}
            rows={2}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => decide("reject")}
              className="flex-1 rounded-lg border border-[var(--destructive)] px-3 py-2 text-sm font-semibold text-[var(--destructive)]"
            >
              Reject
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => decide("approve")}
              className="flex-1 rounded-lg bg-[var(--primary)] px-3 py-2 text-sm font-semibold text-[var(--primary-foreground)]"
            >
              Approve Dismissal
            </button>
          </div>
        </>
      )}
    </div>
  );
}
