import { describe, expect, it } from "vitest";
import { archiveEligibility, ARCHIVABLE_STATUSES } from "./archive-policy";

describe("complaint archive workflow policy", () => {
  it("allows every retained complaint lifecycle state", () => {
    expect(ARCHIVABLE_STATUSES.has("resolved")).toBe(true);
    for (const status of ["submitted", "assigned", "in_progress", "pending_information", "escalated", "resolved", "closed", "withdrawn"]) {
      expect(archiveEligibility(status)).toBeNull();
    }
  });

  it("blocks unknown lifecycle states", () => {
    expect(archiveEligibility("unknown")).toMatch(/cannot be archived/);
  });
});
