"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowRightLeft, Loader2 } from "lucide-react";
import { Modal } from "@/components/admin/Modal";
import { FormField, inputClass } from "@/components/admin/FormField";
import { useConfirm } from "@/components/shared/ConfirmDialog";
import { useToast } from "@/components/shared/Toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FieldError } from "@/components/ui/form-field";

interface EligibleOffice {
  _id: string;
  name: string;
}

const REASSIGN_REASONS = [
  { value: "incorrect_initial_routing", label: "Incorrect Initial Routing" },
  { value: "belongs_to_another_office", label: "Complaint Belongs to Another Office" },
  { value: "another_units_responsibility", label: "Matter Falls Under Another Unit's Responsibility" },
  { value: "requires_specialized_handling", label: "Requires Specialized Office Handling" },
  { value: "administrative_transfer", label: "Administrative Transfer" },
  { value: "other", label: "Other" },
] as const;

export function ReassignOfficeDialog({
  complaintId,
  currentOfficeName,
  eligibleOffices,
}: {
  complaintId: string;
  currentOfficeName: string | null;
  eligibleOffices: EligibleOffice[];
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const { show: showToast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [destinationOfficeId, setDestinationOfficeId] = useState(eligibleOffices[0]?._id ?? "");
  const [reasonCode, setReasonCode] = useState<string>("");
  const [reasonText, setReasonText] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const destinationName =
    eligibleOffices.find((office) => office._id === destinationOfficeId)?.name ?? "the selected office";

  async function submit() {
    if (!destinationOfficeId) {
      setError("Select a destination office.");
      return;
    }
    if (!reasonCode) {
      setReasonError("Please select a reason.");
      return;
    }
    if (reasonCode === "other" && !reasonText.trim()) {
      setReasonError("Please explain the reason.");
      return;
    }
    setReasonError(null);

    const ok = await confirm({
      title: "Reassign Office",
      message: `Transfer this complaint from ${currentOfficeName ?? "the current office"} to ${destinationName}? The destination office head will assign staff.`,
      confirmLabel: "Reassign Office",
    });
    if (!ok) return;

    setError(null);
    setIsSubmitting(true);
    const res = await fetch(`/api/complaints/${complaintId}/reassign-office`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ destinationOfficeRef: destinationOfficeId, reasonCode, reasonText }),
    });
    const data = await res.json().catch(() => ({}));
    setIsSubmitting(false);

    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Could not reassign this complaint.");
      return;
    }

    showToast("Complaint reassigned to another office.");
    setIsOpen(false);
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 rounded-full border border-[var(--border)] px-4 py-2.5 text-sm font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--muted)]"
      >
        <ArrowRightLeft className="h-4 w-4" />
        Reassign Office
      </button>

      {isOpen && (
        <Modal title="Reassign Office" onClose={() => setIsOpen(false)}>
          <div className="space-y-4">
            <p className="text-xs text-[var(--muted-foreground)]">
              Reassignment transfers the complaint to another appropriate office at the same
              organizational level. Use Escalate for higher authority.
            </p>

            {error && (
              <div className="flex items-start gap-2 rounded-2xl border border-[var(--destructive)]/40 bg-[var(--destructive)]/10 px-3 py-2 text-sm text-[var(--destructive)]">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <FormField label="Current office">
              <p className="rounded-2xl border border-[var(--border)] bg-[var(--muted)]/30 px-4 py-2.5 text-sm font-medium text-[var(--foreground)]">
                {currentOfficeName ?? "No office assigned"}
              </p>
            </FormField>

            <FormField label="Destination office" required>
              <Select value={destinationOfficeId} onValueChange={setDestinationOfficeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select office" />
                </SelectTrigger>
                <SelectContent>
                  {eligibleOffices.map((office) => (
                    <SelectItem key={office._id} value={office._id}>
                      {office.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            <FormField label="Reason" required>
              <div className="space-y-2">
                <Select
                  value={reasonCode}
                  onValueChange={(value) => {
                    setReasonCode(value);
                    setReasonError(null);
                  }}
                >
                  <SelectTrigger aria-invalid={!!reasonError} aria-describedby="reassign-reason-error">
                    <SelectValue placeholder="Select a reason" />
                  </SelectTrigger>
                  <SelectContent>
                    {REASSIGN_REASONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {reasonCode === "other" && (
                  <textarea
                    rows={3}
                    value={reasonText}
                    onChange={(event) => {
                      setReasonText(event.target.value);
                      if (event.target.value.trim()) setReasonError(null);
                    }}
                    aria-invalid={!!reasonError}
                    aria-describedby="reassign-reason-error"
                    className={inputClass}
                    placeholder="Explain the reason"
                  />
                )}
                <FieldError id="reassign-reason-error" message={reasonError} />
              </div>
            </FormField>

            <button
              type="button"
              onClick={submit}
              disabled={isSubmitting || !destinationOfficeId || !reasonCode || (reasonCode === "other" && !reasonText.trim())}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-[var(--primary)] px-3 py-2.5 text-sm font-semibold text-[var(--primary-foreground)] transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRightLeft className="h-4 w-4" />}
              {isSubmitting ? "Reassigning..." : "Reassign Office"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
