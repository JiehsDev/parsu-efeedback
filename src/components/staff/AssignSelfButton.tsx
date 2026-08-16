// src/components/staff/AssignSelfButton.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2, UserPlus } from "lucide-react";
import { useToast } from "@/components/shared/Toast";

export function AssignSelfButton({ complaintId }: { complaintId: string }) {
  const router = useRouter();
  const { show: showToast } = useToast();
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

    showToast("Complaint assigned to you");
    router.refresh();
  }

  return (
    <div>
      {error && (
        <div className="mb-2 flex items-start gap-2 rounded-2xl border border-[var(--destructive)]/40 bg-[var(--destructive)]/10 px-3 py-2 text-sm text-[var(--destructive)]">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      <button
        onClick={handleClick}
        disabled={isSubmitting}
        className="flex w-full items-center justify-center gap-2 rounded-full bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-[var(--primary-foreground)] transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {isSubmitting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <UserPlus className="h-4 w-4" />
        )}
        {isSubmitting ? "Assigning…" : "Pick Up This Complaint"}
      </button>
    </div>
  );
}
