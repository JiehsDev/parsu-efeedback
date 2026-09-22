import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";

vi.mock("@/lib/env", () => ({
  env: { NEXT_PUBLIC_APP_URL: "https://parsu.example", RESEND_FROM_EMAIL: "test@parsu.example" },
}));
vi.mock("@/lib/resend", () => ({
  resend: { emails: { send: vi.fn() } },
  isResendConfigured: () => false,
}));

import { connectTestDb, disconnectTestDb, clearTestDb } from "@/test/setup-db";
import { createTestUser, createActivatableCategory } from "@/test/fixtures";
import { Complaint } from "@/models/Complaint";
import { ComplaintTimeline } from "@/models/ComplaintTimeline";
import { AuditLog } from "@/models/AuditLog";
import type { ComplaintStatus } from "@/lib/constants";
import {
  closeComplaintWithRating,
  closeComplaintWithoutRating,
} from "./resolution-closure.service";

beforeAll(connectTestDb);
afterAll(disconnectTestDb);
beforeEach(clearTestDb);

async function setup(status: ComplaintStatus = "resolved") {
  const { category, office } = await createActivatableCategory();
  const student = await createTestUser({ role: "student" });
  const otherStudent = await createTestUser({ role: "student" });
  const staff = await createTestUser({ role: "office_staff", officeRef: office._id });
  const complaint = await Complaint.create({
    ticketNumber: `TEST-CLOSE-${Date.now()}-${Math.random()}`,
    studentRef: student._id,
    categoryRef: category._id,
    title: "Resolution closure test complaint",
    description: "A complaint with enough description for the closure workflow test.",
    priority: "medium",
    status,
    assignedOfficeRef: office._id,
    assignedStaffRef: staff._id,
  });
  return { complaint, student, otherStudent, staff, office };
}

describe("closeComplaintWithRating", () => {
  it("rates and closes a resolved complaint owned by the student", async () => {
    const { complaint, student } = await setup();

    const result = await closeComplaintWithRating({
      complaintId: String(complaint._id),
      studentId: String(student._id),
      rating: 5,
      comment: "Great service",
    });

    expect("error" in result).toBe(false);
    const saved = await Complaint.findById(complaint._id).lean();
    expect((saved as any)!.status).toBe("closed");
    expect((saved as any)!.studentRating).toBe(5);
    expect((saved as any)!.studentRatingComment).toBe("Great service");
    expect((saved as any)!.closureType).toBe("rated");
    expect(String((saved as any)!.closedByRef)).toBe(String(student._id));
    expect((saved as any)!.closedAt).not.toBeNull();

    const timeline = await ComplaintTimeline.find({ complaintRef: complaint._id }).lean();
    expect(timeline.map((t: any) => t.eventType)).toEqual(expect.arrayContaining(["rated", "closed"]));

    const audits = await AuditLog.find({ entityId: complaint._id }).lean();
    expect(audits.map((a: any) => a.action)).toEqual(expect.arrayContaining(["COMPLAINT_RATED", "COMPLAINT_CLOSED"]));
  });

  it("rejects a student who does not own the complaint", async () => {
    const { complaint, otherStudent } = await setup();
    const result = await closeComplaintWithRating({
      complaintId: String(complaint._id),
      studentId: String(otherStudent._id),
      rating: 5,
    });
    expect(result).toMatchObject({ status: 403 });
  });

  it("rejects rating a complaint that isn't resolved", async () => {
    const { complaint, student } = await setup("in_progress");
    const result = await closeComplaintWithRating({
      complaintId: String(complaint._id),
      studentId: String(student._id),
      rating: 5,
    });
    expect(result).toMatchObject({ status: 400 });
  });

  it("rejects a complaint that already has a rating", async () => {
    const { complaint, student } = await setup();
    complaint.studentRating = 3;
    await complaint.save();
    const result = await closeComplaintWithRating({
      complaintId: String(complaint._id),
      studentId: String(student._id),
      rating: 5,
    });
    expect(result).toMatchObject({ status: 409 });
  });

  it("rejects an archived complaint", async () => {
    const { complaint, student } = await setup();
    complaint.isArchived = true;
    await complaint.save();
    const result = await closeComplaintWithRating({
      complaintId: String(complaint._id),
      studentId: String(student._id),
      rating: 5,
    });
    expect(result).toMatchObject({ status: 400 });
  });
});

describe("closeComplaintWithoutRating", () => {
  it("closes a resolved complaint owned by the student, leaving rating null", async () => {
    const { complaint, student } = await setup();

    const result = await closeComplaintWithoutRating({
      complaintId: String(complaint._id),
      studentId: String(student._id),
    });

    expect("error" in result).toBe(false);
    const saved = await Complaint.findById(complaint._id).lean();
    expect((saved as any)!.status).toBe("closed");
    expect((saved as any)!.studentRating).toBeNull();
    expect((saved as any)!.closureType).toBe("without_rating");
    expect(String((saved as any)!.closedByRef)).toBe(String(student._id));
    expect((saved as any)!.closedAt).not.toBeNull();

    const timeline = await ComplaintTimeline.find({ complaintRef: complaint._id }).lean();
    expect(timeline.map((t: any) => t.eventType)).toEqual(expect.arrayContaining(["closed"]));
    expect(timeline.some((t: any) => t.eventType === "rated")).toBe(false);

    const audits = await AuditLog.find({ entityId: complaint._id }).lean();
    expect(audits.map((a: any) => a.action)).toEqual(expect.arrayContaining(["COMPLAINT_CLOSED"]));
  });

  it("rejects a student who does not own the complaint", async () => {
    const { complaint, otherStudent } = await setup();
    const result = await closeComplaintWithoutRating({
      complaintId: String(complaint._id),
      studentId: String(otherStudent._id),
    });
    expect(result).toMatchObject({ status: 403 });
  });

  it("rejects closing a complaint that isn't resolved", async () => {
    const { complaint, student } = await setup("in_progress");
    const result = await closeComplaintWithoutRating({
      complaintId: String(complaint._id),
      studentId: String(student._id),
    });
    expect(result).toMatchObject({ status: 400 });
  });

  it("rejects a complaint that is already closed", async () => {
    const { complaint, student } = await setup("closed");
    const result = await closeComplaintWithoutRating({
      complaintId: String(complaint._id),
      studentId: String(student._id),
    });
    expect(result).toMatchObject({ status: 400 });
  });

  it("rejects an archived complaint", async () => {
    const { complaint, student } = await setup();
    complaint.isArchived = true;
    await complaint.save();
    const result = await closeComplaintWithoutRating({
      complaintId: String(complaint._id),
      studentId: String(student._id),
    });
    expect(result).toMatchObject({ status: 400 });
  });
});
