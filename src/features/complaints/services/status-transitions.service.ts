// src/features/complaints/services/status-transitions.service.ts
import type { ComplaintStatus } from "@/lib/constants";

// BR-041/043 lifecycle — see docs/architecture.md §7
const ALLOWED_TRANSITIONS: Record<ComplaintStatus, ComplaintStatus[]> = {
  // BR-101: a student may withdraw their own complaint while it's still
  // unpicked-up — who may trigger this (student, owner, only from
  // "submitted") is enforced in the route handler, not here; this only
  // says the state-machine edge itself is legal.
  submitted: ["assigned", "withdrawn"],
  assigned: ["in_progress", "escalated"],
  in_progress: ["pending_information", "escalated", "resolved"],
  pending_information: ["in_progress"],
  escalated: ["in_progress", "assigned"],
  resolved: ["closed", "in_progress"], // BR-043: reopening
  closed: ["in_progress"], // BR-043: reopening even after close
  withdrawn: [], // terminal — a withdrawn complaint is not reopened, resubmit instead
};

export function isValidTransition(from: ComplaintStatus, to: ComplaintStatus): boolean {
  if (from === to) return false;
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}
