// src/models/referential-integrity.integration.test.ts
// BR-099: every cross-collection reference must point to a valid, existing
// record. Mongoose has no automatic FK/referential-integrity enforcement
// by default, so these tests assert the CORRECT/documented behavior
// (rejection) and are expected to reveal a real gap if the current schema
// doesn't actually enforce it — see the report for what to do about it,
// not fixed here per this task's instructions.
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { Types } from "mongoose";
import { connectTestDb, disconnectTestDb, clearTestDb } from "@/test/setup-db";
import { Complaint } from "@/models/Complaint";
import { RoutingRule } from "@/models/RoutingRule";
import { createTestUser, createActivatableCategory } from "@/test/fixtures";

beforeAll(connectTestDb);
afterAll(disconnectTestDb);
beforeEach(clearTestDb);

describe("Referential integrity — BR-099", () => {
  it("Complaint.create with a nonexistent studentRef should be rejected", async () => {
    const { category, office } = await createActivatableCategory();
    const bogusStudentRef = new Types.ObjectId();

    await expect(
      Complaint.create({
        ticketNumber: `TEST-${Date.now()}`,
        studentRef: bogusStudentRef,
        categoryRef: category._id,
        title: "Test complaint",
        description: "Test description long enough to pass validation",
        priority: "medium",
        status: "submitted",
        assignedOfficeRef: office._id,
      }),
    ).rejects.toThrow();
  });

  it("Complaint.create with a nonexistent categoryRef should be rejected", async () => {
    const student = await createTestUser({ role: "student" });
    const bogusCategoryRef = new Types.ObjectId();

    await expect(
      Complaint.create({
        ticketNumber: `TEST-${Date.now()}`,
        studentRef: student._id,
        categoryRef: bogusCategoryRef,
        title: "Test complaint",
        description: "Test description long enough to pass validation",
        priority: "medium",
        status: "submitted",
      }),
    ).rejects.toThrow();
  });

  it("RoutingRule.create with a nonexistent targetOfficeRef should be rejected", async () => {
    const { category } = await createActivatableCategory();
    const bogusOfficeRef = new Types.ObjectId();

    await expect(
      RoutingRule.create({
        categoryRef: new Types.ObjectId(), // fresh rule, category above already has an active one
        targetOfficeRef: bogusOfficeRef,
        conditions: {},
        priority: 0,
        isActive: true,
      }),
    ).rejects.toThrow();
  });
});
