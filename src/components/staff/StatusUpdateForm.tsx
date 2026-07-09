// src/components/staff/StatusUpdateForm.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ALLOWED_TRANSITIONS_CLIENT, STATUS_LABELS } from "@/lib/status-transitions-client";
import type { ComplaintStatus } from "@/lib/constants";

export function StatusUpdateForm({
  complaintId,
  currentStatus,
}: {
  complaintId: string;
  currentStatus: ComplaintStatus;
}) {
  const router = useRouter();
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

    setMessage("");
    setNextStatus("");
    router.refresh();
  }

  if (options.length === 0) return null;

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-4"
    >
      <p className="text-sm font-medium text-[var(--foreground)]">Update status</p>
      {error && <p className="mt-2 text-sm text-[var(--destructive)]">{error}</p>}

      <div className="mt-3 flex gap-2">
        <select
          value={nextStatus}
          onChange={(e) => setNextStatus(e.target.value)}
          className="flex-1 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--ring)] focus:ring-1 focus:ring-[var(--ring)]"
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

      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Optional note about this change"
        rows={2}
        className="mt-2 w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--ring)] focus:ring-1 focus:ring-[var(--ring)]"
      />

      <button
        type="submit"
        disabled={isSubmitting || !nextStatus}
        className="mt-2 rounded-[var(--radius)] bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {isSubmitting ? "Updating…" : "Update Status"}
      </button>
    </form>
  );
}
