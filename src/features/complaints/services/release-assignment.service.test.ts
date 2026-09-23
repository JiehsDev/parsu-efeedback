import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";

vi.mock("@/lib/env", () => ({
  env: { NEXT_PUBLIC_APP_URL: "https://parsu.example", RESEND_FROM_EMAIL: "test@parsu.example" },
}));
vi.mock("@/lib/resend", () => ({
  resend: { emails: { send: vi.fn() } },
  isResendConfigured: () => false,
}));

import { connectTestDb, disconnectTestDb, clearTestDb } from "@/test/setup-db";
import { createTestUser, createTestOffice, createActivatableCategory } from "@/test/fixtures";
import { Complaint } from "@/models/Complaint";
import { Office } from "@/models/Office";
import { Assignment } from "@/models/Assignment";
import { ComplaintTimeline } from "@/models/ComplaintTimeline";
import { AuditLog } from "@/models/AuditLog";
import { Notification } from "@/models/Notification";
import type { ComplaintStatus } from "@/lib/constants";
import { releaseAssignment } from "./release-assignment.service";

beforeAll(connectTestDb);
afterAll(disconnectTestDb);
beforeEach(clearTestDb);

async function setup(status: ComplaintStatus = "in_progress") {
  const { category } = await createActivatableCategory();
  const office = await createTestOffice({ name: "Registrar" });
  const head = await createTestUser({ role: "office_staff", officeRef: office._id });
  const staff = await createTestUser({ role: "office_staff", officeRef: office._id });
  const otherStaff = await createTestUser({ role: "office_staff", officeRef: office._id });
  await Office.updateOne({ _id: office._id }, { $set: { headUserRef: head._id } });
  const student = await createTestUser({ role: "student" });
  const complaint = await Complaint.create({
    ticketNumber: `TEST-RELEASE-${Date.now()}-${Math.random()}`,
    studentRef: student._id,
    categoryRef: category._id,
    title: "Assignment release test complaint",
    description: "A complaint with enough description for the release workflow test.",
    priority: "medium",
    status,
    assignedOfficeRef: office._id,
    assignedStaffRef: staff._id,
  });
  return { complaint, office, head, staff, otherStaff };
}

describe("releaseAssignment", () => {
  it("returns the complaint to submitted, preserves the office, and records all release history", async () => {
    const { complaint, office, staff, head } = await setup();
    await Assignment.create({
      complaintRef: complaint._id,
      assignedByRef: head._id,
      assignedToRef: staff._id,
      sourceOfficeRef: office._id,
      destinationOfficeRef: office._id,
      actionType: "assign",
    });
    await ComplaintTimeline.create({ complaintRef: complaint._id, eventType: "note_added", actorRef: staff._id, message: "Existing history" });

    const result = await releaseAssignment({
      complaintId: String(complaint._id),
      actorId: String(staff._id),
      actorRole: "office_staff",
      reason: "Workload / Availability",
    });

    expect("error" in result).toBe(false);
    const saved = await Complaint.findById(complaint._id).lean();
    expect(String((saved as any)!.assignedOfficeRef)).toBe(String(office._id));
    expect((saved as any)!.assignedStaffRef).toBeNull();
    expect((saved as any)!.status).toBe("submitted");
    expect(await Assignment.countDocuments({ complaintRef: complaint._id })).toBe(2);
    expect(await ComplaintTimeline.countDocuments({ complaintRef: complaint._id, eventType: "note_added" })).toBe(1);
    expect(await ComplaintTimeline.countDocuments({ complaintRef: complaint._id, eventType: "assignment_released" })).toBe(1);
    expect(await AuditLog.exists({ entityId: complaint._id, action: "ASSIGNMENT_RELEASED" })).not.toBeNull();
    expect(await Notification.exists({ userRef: head._id, type: "assignment_released", relatedComplaintRef: complaint._id })).not.toBeNull();
  });

  it("requires a reason and only allows the current assigned handler", async () => {
    const { complaint, staff, otherStaff } = await setup();
    await expect(releaseAssignment({ complaintId: String(complaint._id), actorId: String(staff._id), actorRole: "office_staff", reason: "" })).resolves.toMatchObject({ status: 400 });
    await expect(releaseAssignment({ complaintId: String(complaint._id), actorId: String(otherStaff._id), actorRole: "office_staff", reason: "Not my assignment" })).resolves.toMatchObject({ status: 403 });
  });

  it("blocks resolved, closed, withdrawn, and archived complaints", async () => {
    for (const status of ["resolved", "closed", "withdrawn"] as ComplaintStatus[]) {
      const { complaint, staff } = await setup(status);
      await expect(releaseAssignment({ complaintId: String(complaint._id), actorId: String(staff._id), actorRole: "office_staff", reason: "Should be blocked" })).resolves.toMatchObject({ status: 400 });
    }
    const { complaint, staff } = await setup();
    await Complaint.updateOne({ _id: complaint._id }, { $set: { isArchived: true } });
    await expect(releaseAssignment({ complaintId: String(complaint._id), actorId: String(staff._id), actorRole: "office_staff", reason: "Should be blocked" })).resolves.toMatchObject({ status: 400 });
  });

  it("allows pending information to return to submitted without deleting its workflow history", async () => {
    const { complaint, staff } = await setup("pending_information");
    const result = await releaseAssignment({ complaintId: String(complaint._id), actorId: String(staff._id), actorRole: "office_staff", reason: "Unavailable to continue handling" });
    expect("error" in result).toBe(false);
    expect((await Complaint.findById(complaint._id).lean())!.status).toBe("submitted");
  });
});
