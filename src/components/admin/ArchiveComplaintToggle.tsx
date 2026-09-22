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
  mode = "admin",
}: {
  complaintId: string;
  ticketNumber: string;
  isArchived: boolean;
  mode?: "admin" | "head";
}) {
  const router = useRouter();
  const { show: showToast } = useToast();
  const confirm = useConfirm();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reason, setReason] = useState("");
  const [customReason, setCustomReason] = useState("");

  const selectedReason = reason === "Other" ? customReason.trim() : reason;

  async function handleToggle() {
    if (!selectedReason) { showToast("Please provide an archive reason.", "error"); return; }
    if (!isArchived && mode === "admin") {
      const ok = await confirm({ title: "Archive this complaint?", message: `"${ticketNumber}" will be retained and can be restored later.`, confirmLabel: "Archive", danger: true });
      if (!ok) return;
    }

    setIsSubmitting(true);
    const res = await fetch(mode === "admin" ? `/api/admin/complaints/${complaintId}` : `/api/complaints/${complaintId}/archive`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isArchived: !isArchived, reason: selectedReason }),
    });
    setIsSubmitting(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      showToast(data.error ?? "Could not update complaint.", "error");
      return;
    }
    showToast(isArchived ? "Complaint restored" : "Complaint archived");
    setReason(""); setCustomReason("");
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Archive reason *" className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--foreground)]" />
      <p className="text-[11px] text-[var(--muted-foreground)]">Suggested: Complaint completed · Duplicate complaint · No further action required · Administrative closure · Other</p>
      {reason === "Other" && <textarea value={customReason} onChange={(event) => setCustomReason(event.target.value)} rows={2} placeholder="Explain the archive reason" className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--foreground)]" />}
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
    </div>
  );
}
