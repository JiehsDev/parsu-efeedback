"use client";

import { clientFetch } from "@/lib/client-fetch";

import { useEffect, useState } from "react";
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

interface StaffOption {
  _id: string;
  firstName: string;
  lastName: string;
  email?: string;
}

const REASSIGNMENT_REASONS = [
  "Staff availability",
  "Workload balancing",
  "Specialist assistance",
  "OSAS Head review",
  "Other",
] as const;

export function AssignmentDialog({
  complaintId,
  currentOfficeId,
  currentOfficeName,
  currentStaffId,
  currentStaffName,
  label,
  action = "reassign",
}: {
  complaintId: string;
  currentOfficeId: string | null;
  currentOfficeName: string | null;
  currentStaffId: string | null;
  currentStaffName: string | null;
  label?: string;
  action?: "assign" | "reassign" | "escalate";
}) {
  const router = useRouter();
  const { show: showToast } = useToast();
  const confirm = useConfirm();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedStaffId, setSelectedStaffId] = useState(currentStaffId ?? "");
  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [staffError, setStaffError] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [customReason, setCustomReason] = useState("");
  const requiresReason = action === "reassign" || action === "escalate";

  const title =
    label ??
    (action === "escalate"
      ? "Request OSAS Head Review"
      : action === "reassign"
        ? "Change Assignee"
        : "Assign Staff");

  useEffect(() => {
    if (!isOpen || !currentOfficeId || action === "escalate") return;
    setLoadingStaff(true);
    clientFetch(`/api/offices/${currentOfficeId}/staff`)
      .then((res) => (res.ok ? res.json() : { staff: [] }))
      .then((data) => setStaff(data.staff ?? []))
      .catch(() => setStaff([]))
      .finally(() => setLoadingStaff(false));
  }, [action, isOpen, currentOfficeId]);

  useEffect(() => {
    if (!isOpen) return;
    setSelectedStaffId(currentStaffId ?? "");
    setStaffError(null);
    setReasonError(null);
    setReason("");
    setCustomReason("");
    setError(null);
  }, [currentStaffId, isOpen]);

  async function submit() {
    if (!currentOfficeId) {
      setError("OSAS staff are unavailable. Please try again.");
      return;
    }
    const targetStaff = staff.find((member) => member._id === selectedStaffId);
    if (action !== "escalate" && (loadingStaff || !targetStaff)) {
      setStaffError("Select a staff member to assign this complaint to.");
      return;
    }
    setStaffError(null);
    const assignmentReason = requiresReason
      ? reason === "Other"
        ? customReason.trim()
        : reason
      : customReason.trim();
    if (requiresReason && !assignmentReason) {
      setReasonError(
        action === "escalate"
          ? "Please provide a reason for OSAS Head review."
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
      message:
        action === "escalate"
          ? "Request a review of this complaint by the OSAS Head?"
          : `Assign this complaint to ${targetStaff!.firstName} ${targetStaff!.lastName}?`,
      confirmLabel: title,
    });
    if (!ok) return;

    setError(null);
    setIsSubmitting(true);
    const payload: Record<string, unknown> = {
      message: assignmentReason || undefined,
      action,
    };
    payload.assignedStaffRef = selectedStaffId || null;

    const res = await clientFetch(
      action === "escalate"
        ? `/api/complaints/${complaintId}/escalate`
        : `/api/complaints/${complaintId}/assign`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action === "escalate" ? { reason: assignmentReason } : payload),
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
        ? "OSAS Head review requested"
        : action === "reassign"
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
              <p className="text-xs text-[var(--muted-foreground)]">Handling office</p>
              <p className="mt-1 font-medium text-[var(--foreground)]">
                {currentOfficeName ?? "OSAS"}
              </p>
              <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
                {currentStaffName ? `Staff: ${currentStaffName}` : "No staff member assigned"}
              </p>
            </div>

            {action !== "escalate" && (
              <FormField
                label="Assigned staff"
                required
                hint="Select the staff member responsible for this complaint."
              >
                <Select
                  value={selectedStaffId}
                  onValueChange={(value) => {
                    setSelectedStaffId(value);
                    setStaffError(null);
                  }}
                  disabled={loadingStaff || isSubmitting}
                >
                  <SelectTrigger
                    aria-invalid={!!staffError}
                    aria-describedby="assignment-staff-error"
                  >
                    <SelectValue placeholder="Select staff member" />
                  </SelectTrigger>
                  <SelectContent>
                    {staff.map((member) => (
                      <SelectItem key={member._id} value={member._id}>
                        {member.firstName} {member.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError id="assignment-staff-error" message={staffError} />
                {!loadingStaff && staff.length === 0 && (
                  <p className="mt-1.5 text-xs text-[var(--muted-foreground)]">
                    No active staff members are available in this office.
                  </p>
                )}
                {loadingStaff && (
                  <p className="mt-1.5 flex items-center gap-1.5 text-xs text-[var(--muted-foreground)]">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Loading staff...
                  </p>
                )}
              </FormField>
            )}

            <FormField
              label={
                requiresReason
                  ? action === "escalate"
                    ? "Reason for OSAS Head review"
                    : "Reason for reassignment"
                  : "Assignment note"
              }
              hint={
                requiresReason
                  ? "Required for the assignment history."
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
                !currentOfficeId ||
                (action !== "escalate" &&
                  (loadingStaff || !staff.some((member) => member._id === selectedStaffId))) ||
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
