import { describe, it, expect } from "vitest";
import { reassignOffice } from "./office-reassignment.service";
import type { UserRole } from "@/lib/constants";
describe("retired office reassignment", () => {
  it.each(["osas", "office_staff", "vpaa", "vpaf", "administrator"] as UserRole[])(
    "rejects office transfer by %s",
    async (actorRole) => {
      const result = await reassignOffice({
        actorRole,
        actorId: "actor",
        complaintId: "complaint",
        destinationOfficeId: "ICTO",
        reason: "Transfer",
      });
      expect(result).toMatchObject({ status: 403 });
    },
  );
});
