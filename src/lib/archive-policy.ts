// Archiving is record retention after handling has ended.
export const ARCHIVABLE_STATUSES = new Set(["resolved", "closed", "withdrawn", "dismissed"]);

export function archiveEligibility(status: string) {
  if (ARCHIVABLE_STATUSES.has(status)) return null;
  return "This complaint cannot be archived in its current state.";
}

export const ARCHIVE_REASON_CODES = [
  "routine_retention",
  "administrative_retention",
  "duplicate",
  "invalid",
  "irrelevant",
  "spam",
  "no_action_required",
  "addressed_elsewhere",
  "other",
] as const;

export type ArchiveReasonCode = (typeof ARCHIVE_REASON_CODES)[number];
