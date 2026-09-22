import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";

vi.mock("@/lib/env", () => ({
  env: { NEXT_PUBLIC_APP_URL: "https://parsu.example", RESEND_FROM_EMAIL: "test@parsu.example" },
}));
vi.mock("@/lib/resend", () => ({
  resend: { emails: { send: vi.fn() } },
  isResendConfigured: () => false,
}));

import { connectTestDb, disconnectTestDb, clearTestDb } from "@/test/setup-db";
import { createTestUser, createTestOffice, createTestCollege, createActivatableCategory } from "@/test/fixtures";
import { Complaint } from "@/models/Complaint";
import { Office } from "@/models/Office";
import { Assignment } from "@/models/Assignment";
import { ComplaintTimeline } from "@/models/ComplaintTimeline";
import { AuditLog } from "@/models/AuditLog";
import type { ComplaintStatus } from "@/lib/constants";
import { reassignOffice } from "./office-reassignment.service";

beforeAll(connectTestDb);
afterAll(disconnectTestDb);
beforeEach(clearTestDb);

async function setup(status: ComplaintStatus = "in_progress") {
  const { category } = await createActivatableCategory();
  const registrar = await createTestOffice({ name: "Registrar" });
  const college = await createTestCollege({ name: "College of Science" });
  const unrelated = await createTestOffice({ name: "Unrelated Office" });
  const head = await createTestUser({ role: "office_staff", officeRef: registrar._id });
  const staff = await createTestUser({ role: "office_staff", officeRef: registrar._id });
  await Office.updateOne({ _id: registrar._id }, { $set: { headUserRef: head._id } });
  const student = await createTestUser({ role: "student" });
  const complaint = await Complaint.create({
    ticketNumber: `TEST-REASSIGN-${Date.now()}-${Math.random()}`,
    studentRef: student._id,
    categoryRef: category._id,
    title: "Office reassignment test complaint",
    description: "A complaint with enough description for the reassignment workflow test.",
    priority: "medium",
    status,
    assignedOfficeRef: registrar._id,
    assignedStaffRef: staff._id,
  });
  return { complaint, registrar, college, unrelated, head, staff, student };
}

describe("reassignOffice", () => {
  it("rejects an ordinary (non-head) office_staff", async () => {
    const { complaint, staff, college } = await setup();
    const result = await reassignOffice({
      complaintId: String(complaint._id),
      actorId: String(staff._id),
      actorRole: "office_staff",
      destinationOfficeId: String(college._id),
      reason: "Belongs to another office",
    });
    expect(result).toMatchObject({ status: 403 });
  });

  it("Office Head can reassign to an eligible lateral office (Registrar -> College)", async () => {
    const { complaint, head, college, registrar, staff } = await setup();

    const result = await reassignOffice({
      complaintId: String(complaint._id),
      actorId: String(head._id),
      actorRole: "office_staff",
      destinationOfficeId: String(college._id),
      reason: "Grade concern is under the instructor's college.",
    });

    expect("error" in result).toBe(false);
    const saved = await Complaint.findById(complaint._id).lean();
    expect(String((saved as any)!.assignedOfficeRef)).toBe(String(college._id));
    expect((saved as any)!.assignedStaffRef).toBeNull();
    expect((saved as any)!.status).toBe("in_progress"); // lifecycle status untouched

    const assignment = await Assignment.findOne({ complaintRef: complaint._id, actionType: "office_reassignment" }).lean();
    expect(assignment).not.toBeNull();
    expect(String((assignment as any).sourceOfficeRef)).toBe(String(registrar._id));
    expect(String((assignment as any).destinationOfficeRef)).toBe(String(college._id));
    expect((assignment as any).actionType).not.toBe("manual_escalation");

    const timeline = await ComplaintTimeline.find({ complaintRef: complaint._id }).lean();
    expect(timeline.some((t: any) => t.eventType === "reassigned")).toBe(true);

    const audits = await AuditLog.find({ entityId: complaint._id }).lean();
    expect(audits.map((a: any) => a.action)).toContain("OFFICE_REASSIGNED");
    void staff;
  });

  it("Office Head cannot reassign to the same office", async () => {
    const { complaint, head, registrar } = await setup();
    const result = await reassignOffice({
      complaintId: String(complaint._id),
      actorId: String(head._id),
      actorRole: "office_staff",
      destinationOfficeId: String(registrar._id),
      reason: "Same office",
    });
    expect(result).toMatchObject({ status: 400 });
  });

  it("Office Head cannot reassign to an unrelated, non-lateral office", async () => {
    const { complaint, head, unrelated } = await setup();
    const result = await reassignOffice({
      complaintId: String(complaint._id),
      actorId: String(head._id),
      actorRole: "office_staff",
      destinationOfficeId: String(unrelated._id),
      reason: "Not eligible",
    });
    expect(result).toMatchObject({ status: 400 });
  });

  it("rejects an inactive destination office", async () => {
    const { complaint, head, registrar } = await setup();
    const inactiveCollege = await createTestCollege({ name: "Inactive College", isActive: false });
    const result = await reassignOffice({
      complaintId: String(complaint._id),
      actorId: String(head._id),
      actorRole: "office_staff",
      destinationOfficeId: String(inactiveCollege._id),
      reason: "Inactive destination",
    });
    expect(result).toMatchObject({ status: 400 });
    void registrar;
  });

  it("blocks reassignment when the complaint is resolved, closed, withdrawn, or archived", async () => {
    for (const status of ["resolved", "closed", "withdrawn"] as ComplaintStatus[]) {
      const { complaint, head, college } = await setup(status);
      const result = await reassignOffice({
        complaintId: String(complaint._id),
        actorId: String(head._id),
        actorRole: "office_staff",
        destinationOfficeId: String(college._id),
        reason: "Should be blocked",
      });
      expect(result).toMatchObject({ status: 400 });
    }

    const { complaint, head, college } = await setup();
    await Complaint.updateOne({ _id: complaint._id }, { $set: { isArchived: true } });
    const archivedResult = await reassignOffice({
      complaintId: String(complaint._id),
      actorId: String(head._id),
      actorRole: "office_staff",
      destinationOfficeId: String(college._id),
      reason: "Should be blocked",
    });
    expect(archivedResult).toMatchObject({ status: 400 });
  });

  it("preserves pending_information state and history across reassignment", async () => {
    const { complaint, head, college } = await setup("pending_information");
    const result = await reassignOffice({
      complaintId: String(complaint._id),
      actorId: String(head._id),
      actorRole: "office_staff",
      destinationOfficeId: String(college._id),
      reason: "Belongs to another office",
    });
    expect("error" in result).toBe(false);
    const saved = await Complaint.findById(complaint._id).lean();
    expect((saved as any)!.status).toBe("pending_information");
  });

  it("administrator can reassign without being the office head", async () => {
    const { complaint, college } = await setup();
    const admin = await createTestUser({ role: "administrator" });
    const result = await reassignOffice({
      complaintId: String(complaint._id),
      actorId: String(admin._id),
      actorRole: "administrator",
      destinationOfficeId: String(college._id),
      reason: "Admin override",
    });
    expect("error" in result).toBe(false);
  });
});
