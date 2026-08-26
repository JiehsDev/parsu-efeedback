// src/components/admin/ArchiveComplaintToggle.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Loader2 } from "lucide-react";
import { useToast } from "@/components/shared/Toast";
import { useConfirm } from "@/components/shared/ConfirmDialog";

export function ArchiveComplaintToggle({
  complaintId,
  ticketNumber,
  isArchived,
}: {
  complaintId: string;
  ticketNumber: string;
  isArchived: boolean;
}) {
  const router = useRouter();
  const { show: showToast } = useToast();
  const confirm = useConfirm();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleToggle() {
    if (!isArchived) {
      const ok = await confirm({
        title: "Archive this complaint?",
        message: `"${ticketNumber}" will be hidden from active views everywhere. The record is kept and can be restored later — nothing is deleted.`,
        confirmLabel: "Archive",
        danger: true,
      });
      if (!ok) return;
    }

    setIsSubmitting(true);
    const res = await fetch(`/api/admin/complaints/${complaintId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isArchived: !isArchived }),
    });
    setIsSubmitting(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      showToast(data.error ?? "Could not update complaint.", "error");
      return;
    }
    showToast(isArchived ? "Complaint restored" : "Complaint archived");
    router.refresh();
  }

  return (
    <button
      onClick={handleToggle}
      disabled={isSubmitting}
      className={`flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50 ${
        isArchived
          ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
          : "border border-[var(--destructive)]/40 text-[var(--destructive)]"
      }`}
    >
      {isSubmitting ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : isArchived ? (
        <ArchiveRestore className="h-4 w-4" />
      ) : (
        <Archive className="h-4 w-4" />
      )}
      {isArchived ? "Restore Complaint" : "Archive Complaint"}
    </button>
  );
}
