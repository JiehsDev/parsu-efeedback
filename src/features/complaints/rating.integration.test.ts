// src/features/complaints/rating.integration.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { connectTestDb, disconnectTestDb, clearTestDb } from "@/test/setup-db";
import { Complaint } from "@/models/Complaint";
import { createTestUser, createActivatableCategory } from "@/test/fixtures";

beforeAll(connectTestDb);
afterAll(disconnectTestDb);
beforeEach(clearTestDb);

describe("Complaint ratings — BR-067/068/069", () => {
  async function createComplaint(status = "resolved") {
    const { category, office } = await createActivatableCategory();
    const student = await createTestUser({ role: "student" });

    return Complaint.create({
      ticketNumber: `TEST-${Date.now()}`,
      studentRef: student._id,
      categoryRef: category._id,
      title: "Test complaint",
      description: "Test description long enough to pass validation",
      priority: "medium",
      status,
      assignedOfficeRef: office._id,
      studentRating: null,
    });
  }

  it("BR-069: a resolved complaint can accept a rating", async () => {
    const complaint = await createComplaint("resolved");
    complaint.studentRating = 5;
    await complaint.save();

    const saved = await Complaint.findById(complaint._id).lean();
    expect((saved as any)!.studentRating).toBe(5);
  });

  it("BR-067: schema allows only one rating value (1-5 range enforced)", async () => {
    const complaint = await createComplaint("resolved");
    complaint.studentRating = 6; // out of range
    await expect(complaint.save()).rejects.toThrow();
  });

  it("BR-070: rating and comment fields both persist correctly", async () => {
    const complaint = await createComplaint("resolved");
    complaint.studentRating = 4;
    complaint.studentRatingComment = "Handled well, a bit slow.";
    await complaint.save();

    const saved = await Complaint.findById(complaint._id).lean();
    expect((saved as any)!.studentRating).toBe(4);
    expect((saved as any)!.studentRatingComment).toBe("Handled well, a bit slow.");
  });
});
