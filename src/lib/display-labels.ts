import type { ComplaintStatus, UserRole } from "@/lib/constants";

export function formatEnumLabel(value: string | null | undefined): string {
  if (!value) return "-";
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function actionLabel(value: string | null | undefined): string {
  const labels: Record<string, string> = {
    "user.update": "User Updated",
    "user.create": "User Created",
    "office_head_assigned": "Office Head Assigned",
    "office_head_removed": "Office Head Removed",
    "complaint.sla_escalate": "Automatically Escalated for SLA Breach",
    "complaint.manual_escalate": "Manually Escalated",
    "report.generate": "Report Generated",
  };
  return (value && labels[value]) || formatEnumLabel(value);
}

export const STATUS_LABELS: Record<ComplaintStatus, string> = {
  submitted: "Submitted",
  assigned: "Assigned",
  in_progress: "In Progress",
  pending_information: "Pending Information",
  escalated: "Escalated",
  resolved: "Resolved",
  closed: "Closed",
  withdrawn: "Withdrawn",
};

export function statusLabel(value: string | null | undefined): string {
  return value && value in STATUS_LABELS
    ? STATUS_LABELS[value as ComplaintStatus]
    : formatEnumLabel(value);
}

export function roleLabel(value: string | null | undefined): string {
  const labels: Partial<Record<UserRole, string>> = {
    student: "Student",
    office_staff: "Office Staff",
    administrator: "Administrator",
    vpaa: "VPAA",
    vpaf: "VPAF",
    osas: "OSAS",
  };
  return (value && labels[value as UserRole]) || formatEnumLabel(value);
}

export function priorityLabel(value: string | null | undefined): string {
  return formatEnumLabel(value);
}
