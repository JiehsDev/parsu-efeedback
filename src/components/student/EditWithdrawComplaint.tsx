// src/components/student/EditWithdrawComplaint.tsx
// BR-101: while a complaint is still "submitted" (not yet picked up by
// staff), the submitting student may edit its title/description or
// withdraw it outright. Priority is deliberately NOT student-editable —
// it's inherited from the category (BR-022) and changing it is a staff/
// admin call, not the student's. Once the complaint is picked up, this
// component's parent simply stops rendering it — the route enforces the
// same cutoff server-side regardless.
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2, Pencil, X } from "lucide-react";
import { useToast } from "@/components/shared/Toast";
import { useConfirm } from "@/components/shared/ConfirmDialog";
import { FormField, inputClass } from "@/components/admin/FormField";

export function EditWithdrawComplaint({
  complaintId,
  ticketNumber,
  initialTitle,
  initialDescription,
}: {
  complaintId: string;
  ticketNumber: string;
  initialTitle: string;
  initialDescription: string;
}) {
  const router = useRouter();
  const { show: showToast } = useToast();
  const confirm = useConfirm();

  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const res = await fetch(`/api/complaints/${complaintId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description }),
    });
    setIsSubmitting(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(typeof data.error === "string" ? data.error : "Could not save changes.");
      return;
    }

    showToast("Complaint updated");
    setIsEditing(false);
    router.refresh();
  }

  async function handleWithdraw() {
    const ok = await confirm({
      title: "Withdraw this complaint?",
      message: `"${ticketNumber}" will be withdrawn and no staff will be able to act on it. You can submit a new complaint any time if you change your mind — this can't be undone.`,
      confirmLabel: "Withdraw",
      danger: true,
    });
    if (!ok) return;

    setIsSubmitting(true);
    const res = await fetch(`/api/complaints/${complaintId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "withdrawn" }),
    });
    setIsSubmitting(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      showToast(typeof data.error === "string" ? data.error : "Could not withdraw complaint.", "error");
      return;
    }

    showToast("Complaint withdrawn");
    router.refresh();
  }

  if (!isEditing) {
    return (
      <div className="flex items-center gap-2.5">
        <button
          onClick={() => setIsEditing(true)}
          className="flex items-center gap-1.5 rounded-full border border-[var(--border)] px-3.5 py-2 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--muted)]"
        >
          <Pencil className="h-3.5 w-3.5" />
          Edit
        </button>
        <button
          onClick={handleWithdraw}
          disabled={isSubmitting}
          className="flex items-center gap-1.5 rounded-full border border-[var(--destructive)]/40 px-3.5 py-2 text-sm font-medium text-[var(--destructive)] transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {isSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
          Withdraw
        </button>
        <p className="text-xs text-[var(--muted-foreground)]">
          You can still change or withdraw this — no one has picked it up yet.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSave}
      className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5"
    >
      {error && (
        <div className="flex items-start gap-2 rounded-2xl border border-[var(--destructive)]/40 bg-[var(--destructive)]/10 px-3 py-2 text-sm text-[var(--destructive)]">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <FormField label="Title">
        <input
          required
          minLength={5}
          maxLength={200}
          className={inputClass}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </FormField>

      <FormField label="Description">
        <textarea
          required
          minLength={20}
          rows={4}
          className={inputClass}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </FormField>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => {
            setIsEditing(false);
            setTitle(initialTitle);
            setDescription(initialDescription);
            setError(null);
          }}
          className="flex items-center justify-center gap-2 rounded-full border border-[var(--border)] px-4 py-2.5 text-sm font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--muted)]"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex flex-1 items-center justify-center gap-2 rounded-full bg-[var(--primary)] px-3 py-2.5 text-sm font-semibold text-[var(--primary-foreground)] transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {isSubmitting ? "Saving…" : "Save Changes"}
        </button>
      </div>
    </form>
  );
}
