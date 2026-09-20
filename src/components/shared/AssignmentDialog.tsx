"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2, Shuffle, UserCheck } from "lucide-react";
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

interface AssignmentOfficeOption {
  _id: string;
  name: string;
  type?: string;
}

interface StaffOption {
  _id: string;
  firstName: string;
  lastName: string;
  email?: string;
}

const OFFICE_LEVEL = "__office_level__";
const REASSIGNMENT_REASONS = [
  "Misrouted complaint",
  "Requires another office",
  "Staff workload transfer",
  "Office coordination",
  "Other",
] as const;

export function AssignmentDialog({
  complaintId,
  currentOfficeId,
  currentOfficeName,
  currentStaffId,
  currentStaffName,
  offices,
  canChangeOffice,
  label,
  action = "reassign",
  destinationOfficeId,
  destinationStaffId,
}: {
  complaintId: string;
  currentOfficeId: string | null;
  currentOfficeName: string | null;
  currentStaffId: string | null;
  currentStaffName: string | null;
  offices: AssignmentOfficeOption[];
  canChangeOffice: boolean;
  label?: string;
  action?: "assign" | "reassign" | "escalate";
  destinationOfficeId?: string | null;
  destinationStaffId?: string | null;
}) {
  const router = useRouter();
  const { show: showToast } = useToast();
  const confirm = useConfirm();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedOfficeId, setSelectedOfficeId] = useState(
    destinationOfficeId ?? currentOfficeId ?? offices[0]?._id ?? "",
  );
  const [selectedStaffId, setSelectedStaffId] = useState<string>(
    destinationStaffId ?? currentStaffId ?? OFFICE_LEVEL,
  );
  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [customReason, setCustomReason] = useState("");
  const requiresReason = action === "reassign" || action === "escalate";

  const title =
    label ??
    (action === "escalate"
      ? "Escalate Complaint"
      : currentOfficeId || currentStaffId
        ? "Reassign Complaint"
        : "Assign Complaint");
  const selectedOfficeName = useMemo(
    () => offices.find((office) => office._id === selectedOfficeId)?.name ?? "selected office",
    [offices, selectedOfficeId],
  );

  useEffect(() => {
    if (!isOpen || !selectedOfficeId) return;
    setLoadingStaff(true);
    fetch(`/api/offices/${selectedOfficeId}/staff`)
      .then((res) => (res.ok ? res.json() : { staff: [] }))
      .then((data) => setStaff(data.staff ?? []))
      .catch(() => setStaff([]))
      .finally(() => setLoadingStaff(false));
  }, [isOpen, selectedOfficeId]);

  useEffect(() => {
    if (!isOpen) return;
    setSelectedOfficeId(destinationOfficeId ?? currentOfficeId ?? offices[0]?._id ?? "");
    setSelectedStaffId(destinationStaffId ?? currentStaffId ?? OFFICE_LEVEL);
    setReason("");
    setCustomReason("");
    setError(null);
  }, [currentOfficeId, currentStaffId, destinationOfficeId, destinationStaffId, isOpen, offices]);

  async function submit() {
    if (!selectedOfficeId) {
      setError("Select an office before saving.");
      return;
    }
    const transferReason = requiresReason
      ? reason === "Other"
        ? customReason.trim()
        : reason
      : customReason.trim();
    if (requiresReason && !transferReason) {
      setReasonError(
        action === "escalate"
          ? "Please provide a reason for escalation."
          : "Please provide a reason for reassignment.",
      );
      setError("Please correct the highlighted fields below.");
      const field = document.querySelector<HTMLElement>('[aria-invalid="true"]');
      field?.scrollIntoView({ behavior: "smooth", block: "center" });
      field?.focus({ preventScroll: true });
      return;
    }
    setReasonError(null);

    const ok = await confirm({
      title,
      message: `Assign this complaint to ${selectedOfficeName}${
        selectedStaffId === OFFICE_LEVEL ? " at office level" : ""
      }? This will append a new ${action === "escalate" ? "escalation" : "assignment"} history record.`,
      confirmLabel: title,
      danger: currentOfficeId !== null && selectedOfficeId !== currentOfficeId,
    });
    if (!ok) return;

    setError(null);
    setIsSubmitting(true);
    const payload: Record<string, unknown> = {
      message: transferReason || undefined,
      action,
    };
    if (canChangeOffice || selectedOfficeId !== currentOfficeId)
      payload.assignedOfficeRef = selectedOfficeId;
    payload.assignedStaffRef = selectedStaffId === OFFICE_LEVEL ? null : selectedStaffId;

    const res = await fetch(
      action === "escalate"
        ? `/api/complaints/${complaintId}/escalate`
        : `/api/complaints/${complaintId}/assign`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action === "escalate" ? { reason: transferReason } : payload),
      },
    );
    const data = await res.json().catch(() => ({}));
    setIsSubmitting(false);

    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Could not assign complaint.");
      return;
    }

    showToast(
      action === "escalate"
        ? "Complaint escalated"
        : currentOfficeId || currentStaffId
          ? "Complaint reassigned"
          : "Complaint assigned",
    );
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
        <Shuffle className="h-4 w-4" />
        {title}
      </button>

      {isOpen && (
        <Modal title={title} onClose={() => setIsOpen(false)}>
          <div className="space-y-4">
            {error && (
              <div className="flex items-start gap-2 rounded-2xl border border-[var(--destructive)]/40 bg-[var(--destructive)]/10 px-3 py-2 text-sm text-[var(--destructive)]">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="rounded-2xl border border-[var(--border)] bg-[var(--muted)]/30 px-4 py-3 text-sm">
              <p className="text-xs text-[var(--muted-foreground)]">Current authority</p>
              <p className="mt-1 font-medium text-[var(--foreground)]">
                {currentOfficeName ?? "No office assigned"}
              </p>
              <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
                {currentStaffName ? `Staff: ${currentStaffName}` : "No staff member assigned"}
              </p>
            </div>

            <FormField
              label="Destination office"
              hint={
                action === "escalate"
                  ? "The destination is computed from the escalation hierarchy."
                  : !canChangeOffice
                    ? "Office staff may only assign within their own office."
                    : undefined
              }
            >
              <Select
                value={selectedOfficeId}
                onValueChange={(value) => {
                  setSelectedOfficeId(value);
                  setSelectedStaffId(OFFICE_LEVEL);
                }}
                disabled={!canChangeOffice || action === "escalate"}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select office" />
                </SelectTrigger>
                <SelectContent>
                  {offices.map((office) => (
                    <SelectItem key={office._id} value={office._id}>
                      {office.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            <FormField
              label={action === "escalate" ? "Next escalation authority" : "Assigned staff"}
              hint={
                action === "escalate"
                  ? "The configured office head receives the complaint."
                  : "Leave at office level if no individual owner is selected."
              }
            >
              <Select
                value={selectedStaffId}
                onValueChange={setSelectedStaffId}
                disabled={action === "escalate"}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Office level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={OFFICE_LEVEL}>Office level / unassigned</SelectItem>
                  {staff.map((member) => (
                    <SelectItem key={member._id} value={member._id}>
                      {member.firstName} {member.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {loadingStaff && (
                <p className="mt-1.5 flex items-center gap-1.5 text-xs text-[var(--muted-foreground)]">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Loading staff...
                </p>
              )}
            </FormField>

            <FormField
              label={
                requiresReason
                  ? action === "escalate"
                    ? "Reason for escalation"
                    : "Reason for reassignment"
                  : "Assignment note"
              }
              hint={
                requiresReason
                  ? "Required for the transfer record."
                  : "Optional note for the timeline."
              }
              required={requiresReason}
            >
              {requiresReason ? (
                <div className="space-y-2">
                  <Select value={reason} onValueChange={setReason}>
                    <SelectTrigger
                      id="assignment-reason"
                      aria-invalid={!!reasonError}
                      aria-describedby="assignment-reason-error"
                    >
                      <SelectValue placeholder="Select a reason" />
                    </SelectTrigger>
                    <SelectContent>
                      {REASSIGNMENT_REASONS.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {reason === "Other" && (
                    <textarea
                      id="assignment-custom-reason"
                      rows={3}
                      value={customReason}
                      onChange={(event) => {
                        setCustomReason(event.target.value);
                        if (event.target.value.trim()) setReasonError(null);
                      }}
                      aria-invalid={!!reasonError}
                      aria-describedby="assignment-reason-error"
                      className={inputClass}
                      placeholder="Enter the reason"
                    />
                  )}
                  <FieldError id="assignment-reason-error" message={reasonError} />
                </div>
              ) : (
                <textarea
                  rows={3}
                  value={customReason}
                  onChange={(event) => setCustomReason(event.target.value)}
                  className={inputClass}
                  placeholder="Optional note for the assignment"
                />
              )}
            </FormField>

            <button
              type="button"
              onClick={submit}
              disabled={
                isSubmitting ||
                !selectedOfficeId ||
                (requiresReason && (!reason || (reason === "Other" && !customReason.trim())))
              }
              className="flex w-full items-center justify-center gap-2 rounded-full bg-[var(--primary)] px-3 py-2.5 text-sm font-semibold text-[var(--primary-foreground)] transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <UserCheck className="h-4 w-4" />
              )}
              {isSubmitting ? "Saving..." : title}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
