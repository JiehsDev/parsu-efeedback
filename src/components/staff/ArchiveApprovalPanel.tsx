"use client";

import { useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/shared/Toast";

export function ArchiveApprovalPanel({ request }: { request: any }) {
  const router = useRouter();
  const { show: showToast } = useToast();
  const [busy, setBusy] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  async function decide(action: "approve" | "reject") {
    if (action === "reject" && !rejectionReason.trim()) { showToast("Add a rejection note first.", "error"); return; }
    setBusy(true);
    const response = await fetch(`/api/archive-requests/${request._id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, rejectionReason }) });
    const data = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) { showToast(typeof data.error === "string" ? data.error : "Could not decide archive request.", "error"); return; }
    showToast(action === "approve" ? "Complaint archived." : "Archive request rejected."); router.refresh();
  }
  return <div className="rounded-xl border border-[var(--qa-amber)]/40 bg-[var(--qa-amber-soft)] p-3"><p className="text-sm font-semibold text-[var(--qa-amber-strong)]">Archive Request Pending</p><p className="mt-1 text-xs text-[var(--qa-amber-strong)]/85">Requested by {request.requestedByRef?.firstName} {request.requestedByRef?.lastName}</p><p className="mt-1 text-sm text-[var(--qa-amber-strong)]">{request.reason}</p><textarea value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} rows={2} placeholder="Rejection note (required to reject)" className="mt-2 w-full rounded-lg border border-[var(--qa-amber)]/30 bg-[var(--card)] px-2.5 py-2 text-sm" /><div className="mt-2 flex gap-2"><button disabled={busy} onClick={() => decide("reject")} className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-[var(--destructive)]/40 px-2 py-2 text-xs font-semibold text-[var(--destructive)]"><X className="h-3.5 w-3.5" />Reject</button><button disabled={busy} onClick={() => decide("approve")} className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-[var(--primary)] px-2 py-2 text-xs font-semibold text-[var(--primary-foreground)]">{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}Approve Archive</button></div></div>;
}
