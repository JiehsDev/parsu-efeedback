"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { clientFetch } from "@/lib/client-fetch";
import { useToast } from "@/components/shared/Toast";

const REASONS = [
  ["duplicate", "Duplicate complaint"],
  ["invalid", "Invalid complaint"],
  ["outside_scope", "Outside office scope"],
  ["spam", "Spam or nonsense submission"],
  ["no_action_required", "No action required"],
  ["addressed_elsewhere", "Already addressed elsewhere"],
  ["other", "Other"],
] as const;

export function DismissalForm({
  complaintId,
  direct = false,
}: {
  complaintId: string;
  direct?: boolean;
}) {
  const router = useRouter();
  const { show: showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reasonCode, setReasonCode] = useState<(typeof REASONS)[number][0]>("other");
  const [reasonText, setReasonText] = useState("");
  const [internalNote, setInternalNote] = useState("");
  async function submit() {
    if (reasonText.trim().length < 10) {
      showToast("Explain the dismissal in at least 10 characters.", "error");
      return;
    }
    setBusy(true);
    try {
      const response = await clientFetch(
        direct
          ? `/api/complaints/${complaintId}/dismiss`
          : `/api/complaints/${complaintId}/dismissal-requests`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reasonCode,
            reasonText: reasonText.trim(),
            internalNote: internalNote.trim(),
          }),
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        showToast(
          typeof data.error === "string" ? data.error : "Could not submit dismissal.",
          "error",
        );
        return;
      }
      showToast(direct ? "Complaint dismissed." : "Dismissal request sent to the office head.");
      setOpen(false);
      router.refresh();
    } catch {
      showToast("Could not submit dismissal. Please try again.", "error");
    } finally {
      setBusy(false);
    }
  }
  if (!open)
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-xl border border-[var(--border)] px-3 py-2.5 text-sm font-semibold"
      >
        {direct ? "Dismiss Complaint" : "Request Dismissal"}
      </button>
    );
  return (
    <div className="space-y-3 rounded-xl border border-[var(--border)] p-3">
      <p className="text-sm font-semibold">{direct ? "Dismiss complaint" : "Request dismissal"}</p>
      <label htmlFor="dismissal-reason-code" className="block text-sm font-medium">
        Reason
      </label>
      <select
        id="dismissal-reason-code"
        value={reasonCode}
        onChange={(event) => setReasonCode(event.target.value as typeof reasonCode)}
        className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm"
      >
        {REASONS.map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      <label htmlFor="dismissal-reason-text" className="block text-sm font-medium">
        Explanation the student will see
      </label>
      <textarea
        id="dismissal-reason-text"
        value={reasonText}
        onChange={(event) => setReasonText(event.target.value)}
        maxLength={2000}
        rows={4}
        className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm"
        placeholder="Explain why this complaint should be dismissed"
      />
      {!direct && (
        <>
          <label htmlFor="dismissal-internal-note" className="block text-sm font-medium">
            Internal evidence or context (optional)
          </label>
          <textarea
            id="dismissal-internal-note"
            value={internalNote}
            onChange={(event) => setInternalNote(event.target.value)}
            maxLength={2000}
            rows={3}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm"
          />
        </>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => setOpen(false)}
          className="flex-1 rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={submit}
          className="flex-1 rounded-lg bg-[var(--primary)] px-3 py-2 text-sm font-semibold text-[var(--primary-foreground)] disabled:opacity-50"
        >
          {busy ? "Submitting…" : direct ? "Confirm Dismissal" : "Submit Request"}
        </button>
      </div>
    </div>
  );
}
