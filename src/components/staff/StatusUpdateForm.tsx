// src/components/staff/StatusUpdateForm.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ChevronDown, Loader2, MessageSquare, RefreshCw } from "lucide-react";
import { ALLOWED_TRANSITIONS_CLIENT, STATUS_LABELS } from "@/lib/status-transitions-client";
import type { ComplaintStatus } from "@/lib/constants";
import { useToast } from "@/components/shared/Toast";

export function StatusUpdateForm({
  complaintId,
  currentStatus,
}: {
  complaintId: string;
  currentStatus: ComplaintStatus;
}) {
  const router = useRouter();
  const { show: showToast } = useToast();
  const [nextStatus, setNextStatus] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const options = ALLOWED_TRANSITIONS_CLIENT[currentStatus] ?? [];

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!nextStatus) return;
    setError(null);
    setIsSubmitting(true);

    const res = await fetch(`/api/complaints/${complaintId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus, message }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Could not update status.");
      setIsSubmitting(false);
      return;
    }

    showToast(`Status updated to ${STATUS_LABELS[nextStatus as ComplaintStatus]}`);
    setMessage("");
    setNextStatus("");
    router.refresh();
  }

  if (options.length === 0) return null;

  const inputClass =
    "w-full rounded-2xl border border-[var(--border)] bg-[var(--background)]/40 py-2.5 pl-10 pr-3 text-sm text-[var(--foreground)] outline-none transition-colors focus:border-[var(--ring)] focus:ring-1 focus:ring-[var(--ring)]";

  return (
    <form onSubmit={handleSubmit} className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5">
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--primary)]/15 text-[var(--primary)]">
          <RefreshCw className="h-[18px] w-[18px]" />
        </span>
        <p className="text-sm font-semibold text-[var(--foreground)]">Update status</p>
      </div>

      {error && (
        <div className="mt-3 flex items-start gap-2 rounded-2xl border border-[var(--destructive)]/40 bg-[var(--destructive)]/10 px-3 py-2 text-sm text-[var(--destructive)]">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="mt-3 relative">
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
        <select
          value={nextStatus}
          onChange={(e) => setNextStatus(e.target.value)}
          className="w-full appearance-none rounded-2xl border border-[var(--border)] bg-[var(--background)]/40 px-3.5 py-2.5 pr-9 text-sm text-[var(--foreground)] outline-none focus:border-[var(--ring)] focus:ring-1 focus:ring-[var(--ring)]"
        >
          <option value="" disabled>
            Change to…
          </option>
          {options.map((status) => (
            <option key={status} value={status}>
              {STATUS_LABELS[status]}
            </option>
          ))}
        </select>
      </div>

      <div className="relative mt-2">
        <MessageSquare className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-[var(--muted-foreground)]" />
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Optional note about this change"
          rows={2}
          className={`${inputClass} py-2.5`}
        />
      </div>

      <button
        type="submit"
        disabled={isSubmitting || !nextStatus}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-[var(--primary-foreground)] transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
        {isSubmitting ? "Updating…" : "Update Status"}
      </button>
    </form>
  );
}
