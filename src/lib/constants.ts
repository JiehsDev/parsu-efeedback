/**
 * Shared constants — mostly enum value lists consumed by Mongoose schemas
 * in src/models/*.ts. Centralized here so a status/role/type name is never
 * duplicated (and never drifts) across multiple model files.
 *
 * Pure data, no logic. Business rules that *use* these (e.g. which
 * transitions are legal) live in src/features/* starting Phase 8+.
 */

// --- Roles (BR-001, BR-010) ---
// vpaa/vpaf/osas are scoped sub-admin roles: same /admin/** pages/routes as
// administrator, but data-level scoped to college offices, university
// offices, and students respectively (see src/lib/admin-scope.ts).
// administrator remains unrestricted everywhere (BR-010/096).
export const USER_ROLES = [
  "student",
  "office_staff",
  "administrator",
  "vpaa",
  "vpaf",
  "osas",
] as const;
export type UserRole = (typeof USER_ROLES)[number];

// --- Offices (unified college + university-office hierarchy) ---
export const OFFICE_TYPES = ["college_office", "university_office"] as const;
export type OfficeType = (typeof OFFICE_TYPES)[number];

// --- Priority (used by categories, complaints, sla_rules) ---
export const PRIORITY_LEVELS = ["low", "medium", "high", "critical"] as const;
export type PriorityLevel = (typeof PRIORITY_LEVELS)[number];

// --- Suggested response/resolution windows by priority. Admin UI
// convenience defaults only (still editable per rule) — not enforced. ---
export const DEFAULT_SLA_HOURS: Record<
  PriorityLevel,
  { responseHours: number; resolutionHours: number }
> = {
  critical: { responseHours: 4, resolutionHours: 24 },
  high: { responseHours: 8, resolutionHours: 48 },
  medium: { responseHours: 24, resolutionHours: 120 },
  low: { responseHours: 48, resolutionHours: 168 },
};

// --- Complaint status (BR-041 lifecycle, reconciled — see
// docs/schema-reconciliation.md for the mapping from the original
// architecture-blueprint enum to this one) ---
// "withdrawn" (BR-101): a student may cancel their own complaint while it's
// still "submitted" — before any staff has picked it up. Terminal, like
// resolved/closed, but reached only from "submitted" and only by the
// submitting student (enforced in the route handler, not the state
// machine — see status-transitions.service.ts).
export const COMPLAINT_STATUSES = [
  "submitted",
  "assigned",
  "in_progress",
  "pending_information",
  "escalated",
  "resolved",
  "closed",
  "withdrawn",
] as const;
export type ComplaintStatus = (typeof COMPLAINT_STATUSES)[number];

// --- Complaint timeline event types (BR-053/056) ---
export const TIMELINE_EVENT_TYPES = [
  "submitted",
  "assigned",
  "reassigned",
  "status_changed",
  "note_added",
  "attachment_added",
  "escalated",
  "resolved",
  "reopened",
  "closed",
  "rated",
  "edited", // BR-101: student edited title/description/priority pre-pickup
  "withdrawn", // BR-101
  "information_requested",
  "information_submitted",
  "archive_requested",
  "archive_approved",
  "archive_rejected",
  "archived",
  "restored",
] as const;
export type TimelineEventType = (typeof TIMELINE_EVENT_TYPES)[number];

// --- Notification types (BR-074) ---
export const NOTIFICATION_TYPES = [
  "complaint_submitted",
  "complaint_assigned",
  "status_updated",
  "sla_warning",
  "escalation",
  "complaint_resolved",
  "report_generated",
  "system_announcement",
  "archive_request",
  "archive_decision",
  "complaint_restored",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

// --- Generated report format/status (BR-080/082) ---
export const REPORT_FORMATS = ["pdf", "excel", "csv"] as const;
export type ReportFormat = (typeof REPORT_FORMATS)[number];

export const REPORT_STATUSES = ["pending", "generating", "ready", "failed"] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

// --- Audit log actions are free-form strings (BR-076 just requires the
// fields exist), so no fixed enum here — kept as `string` in the model.
