// src/lib/status-transitions-client.ts
// Mirrors src/features/complaints/services/status-transitions.service.ts —
// used only to populate the dropdown; the server route re-validates
// every transition regardless, so this being out of sync would just show
// a wrong option temporarily, never actually allow an invalid change.
import type { ComplaintStatus } from "@/lib/constants";

// "withdrawn" is intentionally NOT offered from "submitted" here — this
// map only drives the staff-facing status dropdown (StatusUpdateForm),
// and withdrawal (BR-101) is a student-only self-service action with its
// own UI (EditWithdrawComplaint), not something staff pick for them.
export const ALLOWED_TRANSITIONS_CLIENT: Record<ComplaintStatus, ComplaintStatus[]> = {
  submitted: ["assigned"],
  assigned: ["in_progress", "escalated"],
  in_progress: ["escalated", "resolved"],
  pending_information: ["in_progress"],
  escalated: ["in_progress", "assigned"],
  resolved: ["closed", "in_progress"],
  closed: ["in_progress"],
  withdrawn: [],
};

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
