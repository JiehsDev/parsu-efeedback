"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2, RotateCcw } from "lucide-react";
import { useToast } from "@/components/shared/Toast";

export function ReopenComplaintButton({ complaintId }: { complaintId: string }) {
  const router = useRouter();
  const { show } = useToast();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!reason.trim()) {
      setError("A reason is required to reopen this complaint.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const response = await fetch(`/api/complaints/${complaintId}/reopen`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(typeof data.error === "string" ? data.error : "Could not reopen complaint.");
        return;
      }
      show("Complaint reopened for further handling");
      setReason("");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-[var(--qa-amber)]/35 bg-[var(--qa-amber-soft)] p-4">
      <div className="flex items-center gap-2">
        <RotateCcw className="h-4 w-4 text-[var(--qa-amber-strong)]" />
        <p className="text-sm font-semibold text-[var(--qa-amber-strong)]">Reopen Complaint</p>
      </div>
      <p className="mt-1 text-xs text-[var(--qa-amber-strong)]/80">Reopening returns this complaint to In Progress and is recorded in the audit trail.</p>
      {error && <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-[var(--destructive)]"><AlertCircle className="h-3.5 w-3.5" />{error}</p>}
      <textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Reason for reopening" rows={3} className="mt-3 w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--ring)]" />
      <button type="submit" disabled={submitting} className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--qa-amber)] px-3 py-2 text-sm font-semibold text-[var(--foreground)] disabled:opacity-50">
        {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
        {submitting ? "Reopening..." : "Reopen Complaint"}
      </button>
    </form>
  );
}
