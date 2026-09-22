// src/components/staff/StatusUpdateForm.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2, MessageSquare, RefreshCw } from "lucide-react";
import { ALLOWED_TRANSITIONS_CLIENT, STATUS_LABELS } from "@/lib/status-transitions-client";
import type { ComplaintStatus } from "@/lib/constants";
import { useToast } from "@/components/shared/Toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FieldError, FieldLabel, focusFirstInvalid } from "@/components/ui/form-field";

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
  const [statusError, setStatusError] = useState<string | null>(null);

  const options = ALLOWED_TRANSITIONS_CLIENT[currentStatus] ?? [];

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!nextStatus) {
      setStatusError("Please select the new complaint status.");
      const formElement = event.currentTarget;
      requestAnimationFrame(() => focusFirstInvalid(formElement));
      return;
    }
    setStatusError(null);
    setError(null);
    setIsSubmitting(true);

    const res = await fetch(`/api/complaints/${complaintId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus, message }),
    });
    setIsSubmitting(false);

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Could not update status.");
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
    <form
      onSubmit={handleSubmit}
      className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5"
    >
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

      <div className="mt-3">
        <Select value={nextStatus} onValueChange={setNextStatus}>
          <FieldLabel required>Status</FieldLabel>
          <SelectTrigger aria-invalid={!!statusError} aria-describedby="status-update-status-error">
            <SelectValue placeholder="Change to…" />
          </SelectTrigger>
          <SelectContent>
            {options.map((status) => (
              <SelectItem key={status} value={status}>
                {STATUS_LABELS[status]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FieldError id="status-update-status-error" message={statusError} />
      </div>

      <div className="relative mt-2">
        <MessageSquare className="pointer-events-none absolute top-3 left-3 h-4 w-4 text-[var(--muted-foreground)]" />
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
