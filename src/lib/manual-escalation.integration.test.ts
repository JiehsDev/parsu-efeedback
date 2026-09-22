import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { connectTestDb, disconnectTestDb, clearTestDb } from "@/test/setup-db";
import {
  createTestCategory,
  createTestCollege,
  createTestOffice,
  createTestUser,
} from "@/test/fixtures";
import { Complaint } from "@/models/Complaint";
import { resolveManualEscalationTarget } from "@/lib/manual-escalation";

beforeAll(connectTestDb);
afterAll(disconnectTestDb);
beforeEach(clearTestDb);

describe("manual escalation hierarchy", () => {
  it("routes ordinary staff to the current office head, then the configured parent head", async () => {
    const vpaa = await createTestOffice({ name: "VPAA", code: "VPAA" });
    const college = await createTestCollege({ parentOffice: vpaa._id });
    const vpaaHead = await createTestUser({ role: "office_staff", officeRef: vpaa._id });
    const collegeHead = await createTestUser({ role: "office_staff", officeRef: college._id });
    const staff = await createTestUser({ role: "office_staff", officeRef: college._id });
    const category = await createTestCategory({ defaultOfficeRef: college._id });
    await vpaa.updateOne({ headUserRef: vpaaHead._id });
    await college.updateOne({ headUserRef: collegeHead._id });

    const complaint = await Complaint.create({
      ticketNumber: "TEST-MANUAL-ESCALATION",
      studentRef: (await createTestUser())._id,
      categoryRef: category._id,
      title: "Manual escalation test",
      description: "A sufficiently long complaint description for this test.",
      priority: "medium",
      status: "in_progress",
      assignedOfficeRef: college._id,
      assignedStaffRef: staff._id,
    });

    const first = await resolveManualEscalationTarget(complaint, "office_staff");
    expect(String(first?.office._id)).toBe(String(college._id));
    expect(String(first?.staff._id)).toBe(String(collegeHead._id));

    complaint.assignedStaffRef = collegeHead._id;
    const second = await resolveManualEscalationTarget(complaint, "office_staff");
    expect(String(second?.office._id)).toBe(String(vpaa._id));
    expect(String(second?.staff._id)).toBe(String(vpaaHead._id));
  });

  it.each([
    ["vpaa", "VPAA"],
    ["vpaf", "VPAF"],
    ["osas", "OSAS"],
  ] as const)("resolves a %s scoped-admin head as an escalation target", async (role, code) => {
    const office = await createTestOffice({ name: code, code });
    const head = await createTestUser({ role, officeRef: office._id });
    await office.updateOne({ headUserRef: head._id });
    const category = await createTestCategory({ defaultOfficeRef: office._id });
    const staff = await createTestUser({ role: "office_staff", officeRef: office._id });
    const complaint = await Complaint.create({
      ticketNumber: `TEST-${code}`,
      studentRef: (await createTestUser())._id,
      categoryRef: category._id,
      title: "Scoped head escalation test",
      description: "A sufficiently long complaint description for this test.",
      priority: "medium",
      status: "in_progress",
      assignedOfficeRef: office._id,
      assignedStaffRef: staff._id,
    });

    const target = await resolveManualEscalationTarget(complaint, "office_staff");
    expect(String(target?.staff._id)).toBe(String(head._id));
    expect(target?.staff.role).toBe(role);
  });
});
