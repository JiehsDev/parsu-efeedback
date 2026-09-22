// Archiving is a record-retention flag, independent from the complaint
// lifecycle. Withdrawn records are also retained and may be archived.
export const ARCHIVABLE_STATUSES = new Set([
  "submitted",
  "assigned",
  "in_progress",
  "pending_information",
  "escalated",
  "resolved",
  "closed",
  "withdrawn",
]);

export function archiveEligibility(status: string) {
  if (ARCHIVABLE_STATUSES.has(status)) return null;
  return "This complaint cannot be archived in its current state.";
}

export const ARCHIVE_REASON_CODES = [
  "duplicate",
  "invalid",
  "irrelevant",
  "spam",
  "no_action_required",
  "addressed_elsewhere",
  "other",
] as const;

export type ArchiveReasonCode = (typeof ARCHIVE_REASON_CODES)[number];
