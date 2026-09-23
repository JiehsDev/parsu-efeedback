"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2, LogOut } from "lucide-react";
import { Modal } from "@/components/admin/Modal";
import { useToast } from "@/components/shared/Toast";

export function ReleaseAssignmentButton({ complaintId }: { complaintId: string }) {
  const router = useRouter();
  const { show: showToast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit() {
    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      setError("A release reason is required.");
      return;
    }
    setError(null);
    setIsSubmitting(true);
    const res = await fetch(`/api/complaints/${complaintId}/release`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: trimmedReason }),
    });
    const data = await res.json().catch(() => ({}));
    setIsSubmitting(false);
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Could not release the assignment.");
      return;
    }
    setIsOpen(false);
    setReason("");
    showToast("Complaint returned to the office queue");
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => { setError(null); setIsOpen(true); }}
        className="flex w-full items-center justify-center gap-2 rounded-full border border-[var(--border)] px-4 py-2.5 text-sm font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--muted)]"
      >
        <LogOut className="h-4 w-4" />
        Release Assignment
      </button>
      {isOpen && (
        <Modal title="Release Assignment" onClose={() => !isSubmitting && setIsOpen(false)}>
          <div className="space-y-4">
            <p className="text-sm text-[var(--muted-foreground)]">
              This returns the complaint to your office&apos;s Submitted queue for reassignment.
            </p>
            {error && (
              <div className="flex items-start gap-2 rounded-2xl border border-[var(--destructive)]/40 bg-[var(--destructive)]/10 px-3 py-2 text-sm text-[var(--destructive)]">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            <label className="block text-sm font-medium text-[var(--foreground)]">
              Release reason <span className="text-[var(--destructive)]">*</span>
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                rows={3}
                placeholder="Explain why you are releasing this assignment"
                className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-sm outline-none focus:border-[var(--ring)] focus:ring-1 focus:ring-[var(--ring)]"
                disabled={isSubmitting}
              />
            </label>
            <button
              type="button"
              onClick={submit}
              disabled={isSubmitting || !reason.trim()}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-[var(--primary-foreground)] disabled:opacity-50"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isSubmitting ? "Releasing..." : "Confirm Release"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
