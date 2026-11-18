import { describe, expect, it } from "vitest";
import { archiveEligibility, ARCHIVABLE_STATUSES } from "./archive-policy";

describe("complaint archive workflow policy", () => {
  it("allows archiving only after the complaint reaches a final state", () => {
    expect(ARCHIVABLE_STATUSES.has("resolved")).toBe(true);
    for (const status of ["resolved", "closed", "withdrawn", "dismissed"]) {
      expect(archiveEligibility(status)).toBeNull();
    }
    for (const status of [
      "submitted",
      "assigned",
      "in_progress",
      "pending_information",
      "escalated",
    ]) {
      expect(archiveEligibility(status)).not.toBeNull();
    }
  });

  it("blocks unknown lifecycle states", () => {
    expect(archiveEligibility("unknown")).toMatch(/cannot be archived/);
  });
});
