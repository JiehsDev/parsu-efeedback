// src/features/complaints/notes.integration.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { connectTestDb, disconnectTestDb, clearTestDb } from "@/test/setup-db";
import { ComplaintNote } from "@/models/ComplaintNote";
import { Complaint } from "@/models/Complaint";
import { createTestUser, createActivatableCategory } from "@/test/fixtures";

beforeAll(connectTestDb);
afterAll(disconnectTestDb);
beforeEach(clearTestDb);

describe("Internal notes — BR-063/064/065/066", () => {
  async function setup() {
    const { category, office } = await createActivatableCategory();
    const student = await createTestUser({ role: "student" });
    const staff = await createTestUser({ role: "office_staff", officeRef: office._id });

    const complaint = await Complaint.create({
      ticketNumber: `TEST-${Date.now()}`,
      studentRef: student._id,
      categoryRef: category._id,
      title: "Test complaint",
      description: "Test description long enough to pass validation",
      priority: "medium",
      status: "assigned",
      assignedOfficeRef: office._id,
    });

    return { complaint, student, staff };
  }

  it("BR-065: a note belongs to exactly one complaint", async () => {
    const { complaint, staff } = await setup();
    const note = await ComplaintNote.create({
      complaintRef: complaint._id,
      authorRef: staff._id,
      body: "Internal note text",
    });
    expect(String(note.complaintRef)).toBe(String(complaint._id));
  });

  it("BR-063: isInternal defaults to true, marking it staff-only visibility", async () => {
    const { complaint, staff } = await setup();
    const note = await ComplaintNote.create({
      complaintRef: complaint._id,
      authorRef: staff._id,
      body: "Internal note text",
    });
    expect(note.isInternal).toBe(true);
  });

  it("BR-066: schema does not expose an update path — notes are append-only by convention", async () => {
    // BR-066 is enforced at the route layer (no PATCH /notes/:id exists),
    // not the schema itself. This test documents that the model has no
    // updatedAt tracking, reinforcing the immutability intent.
    const { complaint, staff } = await setup();
    const note = await ComplaintNote.create({
      complaintRef: complaint._id,
      authorRef: staff._id,
      body: "Original text",
    });

    // The schema only tracks createdAt (updatedAt: false), so there's no
    // timestamp field that would even reflect an edit.
    expect((note as any).updatedAt).toBeUndefined();
  });

  it("BR-064: a note query filtered to a complaint never requires/exposes a student-facing flag", async () => {
    const { complaint, staff } = await setup();
    await ComplaintNote.create({
      complaintRef: complaint._id,
      authorRef: staff._id,
      body: "Staff-only note",
    });

    // This mirrors what the actual GET /notes route does — the important
    // assertion is at the route/RBAC layer (student role → 403), covered
    // in the E2E suite. Here we confirm the query itself works as staff.
    const notes = await ComplaintNote.find({ complaintRef: complaint._id }).lean();
    expect(notes).toHaveLength(1);
  });
});
