import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { connectTestDb, disconnectTestDb, clearTestDb } from "@/test/setup-db";
import { createTestOffice, createTestUser } from "@/test/fixtures";
import { assignOfficeHead } from "@/features/admin/services/office-head.service";

beforeAll(connectTestDb);
afterAll(disconnectTestDb);
beforeEach(clearTestDb);

describe("office head eligibility", () => {
  it.each(["office_staff", "vpaa", "vpaf", "osas"] as const)(
    "allows an active %s user from the same office",
    async (role) => {
      const office = await createTestOffice({ code: `${role}-office` });
      const user = await createTestUser({ role, officeRef: office._id });
      const result = await assignOfficeHead({ officeId: String(office._id), userId: String(user._id), actorId: null });
      expect("error" in result).toBe(false);
    },
  );

  it("rejects inactive users, students, users from another office, and administrators", async () => {
    const office = await createTestOffice({ code: "HEAD-TEST" });
    const otherOffice = await createTestOffice({ code: "HEAD-OTHER" });
    const inactive = await createTestUser({ role: "office_staff", officeRef: office._id, isActive: false });
    const student = await createTestUser({ role: "student" });
    const outsider = await createTestUser({ role: "office_staff", officeRef: otherOffice._id });
    const administrator = await createTestUser({ role: "administrator" });

    for (const user of [inactive, student, outsider, administrator]) {
      const result = await assignOfficeHead({ officeId: String(office._id), userId: String(user._id), actorId: null });
      expect("error" in result).toBe(true);
    }
  });
});
