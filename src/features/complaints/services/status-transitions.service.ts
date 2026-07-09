// src/features/complaints/services/status-transitions.service.ts
import type { ComplaintStatus } from "@/lib/constants";

// BR-041/043 lifecycle — see docs/architecture.md §7
const ALLOWED_TRANSITIONS: Record<ComplaintStatus, ComplaintStatus[]> = {
  submitted: ["assigned"],
  assigned: ["in_progress", "escalated"],
  in_progress: ["pending_information", "escalated", "resolved"],
  pending_information: ["in_progress"],
  escalated: ["in_progress", "assigned"],
  resolved: ["closed", "in_progress"], // BR-043: reopening
  closed: ["in_progress"], // BR-043: reopening even after close
};

export function isValidTransition(from: ComplaintStatus, to: ComplaintStatus): boolean {
  if (from === to) return false;
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}
