"use client";
import { useState } from "react";
import { Archive, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/shared/Toast";

const REASONS = [["duplicate", "Duplicate Complaint"], ["invalid", "Invalid Complaint"], ["irrelevant", "Irrelevant / Outside Scope"], ["spam", "Spam / Nonsense Submission"], ["no_action_required", "No Action Required"], ["addressed_elsewhere", "Complaint Already Addressed Elsewhere"], ["other", "Other"]] as const;

export function ArchiveRequestButton({ complaintId }: { complaintId: string }) {
  const router = useRouter(); const { show: showToast } = useToast();
  const [reasonCode, setReasonCode] = useState("other"); const [reasonText, setReasonText] = useState(""); const [open, setOpen] = useState(false); const [submitting, setSubmitting] = useState(false);
  async function submit() {
    if (!reasonText.trim()) { showToast("Please provide an archive reason.", "error"); return; }
    setSubmitting(true);
    const response = await fetch(`/api/complaints/${complaintId}/archive-request`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reasonCode, reasonText: reasonText.trim() }) });
    const data = await response.json().catch(() => ({})); setSubmitting(false);
    if (!response.ok) { showToast(typeof data.error === "string" ? data.error : "Could not submit archive request.", "error"); return; }
    showToast("Archive request submitted for Office Head approval."); setOpen(false); router.refresh();
  }
  if (!open) return <button onClick={() => setOpen(true)} className="flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--border)] px-3 py-2.5 text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--muted)]"><Archive className="h-4 w-4" />Request Archive</button>;
  return <div className="space-y-2 rounded-xl border border-[var(--border)] p-3"><p className="text-sm font-semibold">Archive Request</p><select value={reasonCode} onChange={(event) => setReasonCode(event.target.value)} className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-2.5 py-2 text-sm">{REASONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><textarea value={reasonText} onChange={(event) => setReasonText(event.target.value)} rows={3} placeholder={reasonCode === "other" ? "Explain the archive reason *" : "Supporting note or context *"} className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-2.5 py-2 text-sm" /><div className="flex gap-2"><button onClick={() => setOpen(false)} className="flex-1 rounded-lg border border-[var(--border)] px-3 py-2 text-sm">Cancel</button><button onClick={submit} disabled={submitting} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-3 py-2 text-sm font-semibold text-[var(--primary-foreground)] disabled:opacity-50">{submitting && <Loader2 className="h-4 w-4 animate-spin" />}Submit Request</button></div></div>;
}
