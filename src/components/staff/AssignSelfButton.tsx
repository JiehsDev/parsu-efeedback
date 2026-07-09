// src/components/staff/AssignSelfButton.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AssignSelfButton({ complaintId }: { complaintId: string }) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setError(null);
    setIsSubmitting(true);

    const session = await fetch("/api/auth/session").then((r) => r.json());
    const staffId = session?.user?.id;

    const res = await fetch(`/api/complaints/${complaintId}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignedStaffRef: staffId, message: "Self-assigned" }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Could not assign complaint.");
      setIsSubmitting(false);
      return;
    }

    router.refresh();
  }

  return (
    <div>
      {error && <p className="mb-2 text-sm text-[var(--destructive)]">{error}</p>}
      <button
        onClick={handleClick}
        disabled={isSubmitting}
        className="rounded-[var(--radius)] bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {isSubmitting ? "Assigning…" : "Pick Up This Complaint"}
      </button>
    </div>
  );
}
