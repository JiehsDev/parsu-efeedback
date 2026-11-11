"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { clientFetch } from "@/lib/client-fetch";
import { useConfirm } from "@/components/shared/ConfirmDialog";
import { useToast } from "@/components/shared/Toast";

export function OfficeReturnRequestDecision({ requestId }: { requestId: string }) {
  const router = useRouter();
  const confirm = useConfirm();
  const { show } = useToast();
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function decide(action: "approve" | "reject") {
    const trimmed = reason.trim();
    if (action === "reject" && trimmed.length < 10) {
      setError("Explain why the complaint should stay with the receiving office.");
      return;
    }
    if (
      action === "approve" &&
      !(await confirm({
        title: "Return complaint to OSAS?",
        message: "The complaint will leave the receiving office and return to the OSAS complaints list, unassigned. Its current status and SLA deadlines will stay unchanged.",
        confirmLabel: "Return to OSAS",
      }))
    )
      return;

    setBusy(true);
    setError("");
    try {
      const response = await clientFetch(`/api/office-return-requests/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason: trimmed }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(typeof data.error === "string" ? data.error : "Could not decide this return request.");
        return;
      }
      show(action === "approve" ? "Complaint returned to OSAS." : "Return request declined.");
      setReason("");
      router.refresh();
    } catch {
      setError("Could not decide this return request. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 space-y-3 border-t border-[var(--border)] pt-4">
      {error && <p role="alert" className="text-sm text-[var(--destructive)]">{error}</p>}
      <label htmlFor={`office-return-decision-${requestId}`} className="block text-sm font-medium">
        Note to receiving office (required to decline)
      </label>
      <textarea
        id={`office-return-decision-${requestId}`}
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        maxLength={2000}
        rows={3}
        disabled={busy}
        placeholder="Explain your decision; if declining, state why the complaint should stay there"
        className="w-full rounded-xl border border-[var(--input)] bg-[var(--background)] p-3 text-sm"
      />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void decide("approve")}
          className="rounded-full bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-[var(--primary-foreground)] disabled:opacity-50"
        >
          {busy ? "Saving…" : "Approve return to OSAS"}
        </button>
        <button
          type="button"
          disabled={busy || reason.trim().length < 10}
          onClick={() => void decide("reject")}
          className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold disabled:opacity-50"
        >
          Decline request
        </button>
      </div>
    </div>
  );
}
