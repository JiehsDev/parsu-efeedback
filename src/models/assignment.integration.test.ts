// src/models/assignment.integration.test.ts
// BR-047/049/050/052 — model-level only. BR-048 (role-gated who may
// assign) and BR-051 (reassignment = new record, not mutation) live
// entirely inside src/app/api/complaints/[id]/assign/route.ts's four
// scope branches — not unit-testable under this repo's no-route-import
// rule, deferred to the E2E suite (assign-scoping.spec.ts).
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { connectTestDb, disconnectTestDb, clearTestDb } from "@/test/setup-db";
import { Assignment } from "@/models/Assignment";
import { createTestUser, createActivatableCategory } from "@/test/fixtures";
import { Complaint } from "@/models/Complaint";

beforeAll(connectTestDb);
afterAll(disconnectTestDb);
beforeEach(clearTestDb);

async function baseComplaint() {
  const { category, office } = await createActivatableCategory();
  const student = await createTestUser({ role: "student" });
  const complaint = await Complaint.create({
    ticketNumber: `TEST-${Date.now()}`,
    studentRef: student._id,
    categoryRef: category._id,
    title: "Test complaint",
    description: "Test description long enough to pass validation",
    priority: "medium",
    status: "submitted",
    assignedOfficeRef: office._id,
  });
  return { complaint, office, student };
}

describe("Assignment model — BR-047/049/050", () => {
  it("BR-047: a complaint may have multiple independent Assignment records, persisted as separate documents", async () => {
    const { complaint, office } = await baseComplaint();
    const staff1 = await createTestUser({ role: "office_staff", officeRef: office._id });
    const staff2 = await createTestUser({ role: "office_staff", officeRef: office._id });

    await Assignment.create({
      complaintRef: complaint._id,
      assignedByRef: null,
      assignedToRef: null,
      destinationOfficeRef: office._id,
    });
    await Assignment.create({
      complaintRef: complaint._id,
      assignedByRef: staff1._id,
      assignedToRef: staff2._id,
      sourceOfficeRef: office._id,
      destinationOfficeRef: office._id,
    });

    const records = await Assignment.find({ complaintRef: complaint._id }).lean();
    expect(records).toHaveLength(2);
    expect(new Set(records.map((r) => String(r._id))).size).toBe(2);
  });

  it("BR-049: required fields (complaintRef, destinationOfficeRef) must be present, and createdAt is auto-stamped", async () => {
    const { complaint, office } = await baseComplaint();

    await expect(
      Assignment.create({
        assignedByRef: null,
        assignedToRef: null,
        // missing complaintRef and destinationOfficeRef
      } as any),
    ).rejects.toThrow();

    const record = await Assignment.create({
      complaintRef: complaint._id,
      destinationOfficeRef: office._id,
    });
    expect(record.get("createdAt")).toBeInstanceOf(Date);
  });

  it("BR-050: a system-originated assignment (assignedByRef: null) is valid", async () => {
    const { complaint, office } = await baseComplaint();

    const record = await Assignment.create({
      complaintRef: complaint._id,
      assignedByRef: null,
      assignedToRef: null,
      destinationOfficeRef: office._id,
    });

    expect(record.assignedByRef).toBeNull();
  });

  // BR-052 (previous records never modified) is enforced only by
  // convention — "only ever calling .create()" at the repository layer,
  // per the model file's own comment — there is no schema-level
  // write-lock, so no test asserts a nonexistent enforcement here.
});
