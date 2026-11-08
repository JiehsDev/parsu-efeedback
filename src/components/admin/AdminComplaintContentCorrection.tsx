"use client";

import { clientFetch } from "@/lib/client-fetch";
import { useConfirm } from "@/components/shared/ConfirmDialog";
import { useToast } from "@/components/shared/Toast";
import { Loader2, PencilLine } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";

export function AdminComplaintContentCorrection({
  complaintId,
  ticketNumber,
  initialTitle,
  initialDescription,
  isArchived,
}: {
  complaintId: string;
  ticketNumber: string;
  initialTitle: string;
  initialDescription: string;
  isArchived: boolean;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const reasonId = useId();
  const router = useRouter();
  const { show: showToast } = useToast();
  const confirm = useConfirm();
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const confirmed = await confirm({
      title: "Correct complaint details?",
      message: `The current title and description for "${ticketNumber}" will be replaced. The reason and before/after content will be recorded in the audit log.`,
      confirmLabel: "Save correction",
    });
    if (!confirmed) return;

    setIsSubmitting(true);
    try {
      const response = await clientFetch(`/api/admin/complaints/${complaintId}/content`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, reason }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        showToast(
          typeof data.error === "string" ? data.error : "Could not correct complaint details.",
          "error",
        );
        return;
      }

      if (data.complaint) {
        setTitle(data.complaint.title);
        setDescription(data.complaint.description);
      }
      setReason("");
      showToast("Complaint details corrected and recorded");
      router.refresh();
    } catch {
      showToast("Could not reach the server. No confirmation was received.", "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="space-y-3 border-t border-[var(--border)] pt-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <PencilLine className="h-4 w-4" />
        Correct complaint details
      </h3>
      <p className="text-xs text-[var(--muted-foreground)]">
        Administrator-only. Requires a reason and records the before/after values in the audit log.
        Complaint status and workflow history are not changed.
      </p>
      {isArchived ? (
        <p className="text-sm text-[var(--muted-foreground)]">
          Restore this complaint before correcting its details.
        </p>
      ) : (
        <form className="space-y-3" onSubmit={handleSubmit}>
          <div className="space-y-1">
            <label htmlFor={titleId} className="block text-xs font-medium">
              Title
            </label>
            <input
              id={titleId}
              required
              minLength={5}
              maxLength={200}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor={descriptionId} className="block text-xs font-medium">
              Description
            </label>
            <textarea
              id={descriptionId}
              required
              minLength={20}
              maxLength={4000}
              rows={5}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor={reasonId} className="block text-xs font-medium">
              Correction reason
            </label>
            <textarea
              id={reasonId}
              required
              minLength={5}
              maxLength={2000}
              rows={2}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Explain why this correction is needed"
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex items-center gap-2 rounded-full bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-[var(--primary-foreground)] disabled:opacity-50"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <PencilLine className="h-4 w-4" />
            )}
            Save corrected details
          </button>
        </form>
      )}
    </section>
  );
}
