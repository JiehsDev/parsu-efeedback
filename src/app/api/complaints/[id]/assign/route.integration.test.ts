import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ auth: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/db", () => ({ connectToDatabase: vi.fn() }));
vi.mock("@/features/audit-log/services/audit-log.service", () => ({ writeAuditLog: vi.fn() }));
vi.mock("@/features/notifications/services/notification.service", () => ({
  notifyComplaintAssigned: vi.fn(),
  notifyComplaintRoutedToOffice: vi.fn(),
  notifyStatusUpdated: vi.fn(),
}));
import { connectTestDb, disconnectTestDb, clearTestDb } from "@/test/setup-db";
import { createTestOffice, createTestUser, createTestCategory } from "@/test/fixtures";
import { Complaint } from "@/models/Complaint";
import { Assignment } from "@/models/Assignment";
import { ComplaintTimeline } from "@/models/ComplaintTimeline";
import { Office } from "@/models/Office";
import { POST } from "./route";

beforeAll(connectTestDb);
afterAll(disconnectTestDb);
beforeEach(clearTestDb);

async function setup() {
  const office = await createTestOffice({ code: "OSAS" });
  const head = await createTestUser({ role: "office_staff", officeRef: office._id });
  const staff = await createTestUser({ role: "office_staff", officeRef: office._id });
  const student = await createTestUser();
  await Office.updateOne({ _id: office._id }, { $set: { headUserRef: head._id } });
  const category = await createTestCategory({ defaultOfficeRef: office._id });
  const complaint = await Complaint.create({
    ticketNumber: "ASSIGN-TARGET",
    studentRef: student._id,
    categoryRef: category._id,
    title: "Assignment target test",
    description: "An assignment must have a valid staff target.",
    priority: "medium",
    status: "submitted",
    assignedOfficeRef: office._id,
  });
  mocks.auth.mockResolvedValue({
    user: { id: String(head._id), role: "office_staff", officeRef: String(office._id) },
  });
  const assign = (body: Record<string, unknown>) =>
    POST(
      new NextRequest("http://localhost/api/complaints/test/assign", {
        method: "POST",
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ id: String(complaint._id) }) },
    );
  return { office, head, staff, student, complaint, assign };
}

describe("assignment requires a target", () => {
  it.each([undefined, null, "", "invalid-id"])(
    "rejects a missing or invalid target (%s) without changing the complaint",
    async (assignedStaffRef) => {
      const { office, complaint, assign } = await setup();
      const response = await assign({
        action: "assign",
        assignedOfficeRef: String(office._id),
        assignedStaffRef,
      });
      expect(response.status).toBe(400);
      expect((await response.json()).fieldErrors.assignedStaffRef).toBeDefined();
      expect((await Complaint.findById(complaint._id))!.status).toBe("submitted");
      expect(await Assignment.countDocuments()).toBe(0);
      expect(await ComplaintTimeline.countDocuments()).toBe(0);
    },
  );

  it.each(["inactive", "other-office", "student"])(
    "rejects %s targets even for an administrator",
    async (invalid) => {
      const { staff, student, complaint, assign } = await setup();
      mocks.auth.mockResolvedValue({ user: { id: String(student._id), role: "administrator" } });
      if (invalid === "inactive") {
        staff.isActive = false;
        await staff.save();
      }
      if (invalid === "other-office") {
        const other = await createTestOffice();
        staff.officeRef = other._id;
        await staff.save();
      }
      expect(
        (
          await assign({
            action: "assign",
            assignedStaffRef: String(invalid === "student" ? student._id : staff._id),
          })
        ).status,
      ).toBe(400);
      expect((await Complaint.findById(complaint._id))!.assignedStaffRef).toBeNull();
    },
  );

  it("saves the selected assignee and assignment history before marking assigned", async () => {
    const { staff, complaint, assign } = await setup();
    expect(
      (
        await assign({
          action: "assign",
          assignedStaffRef: String(staff._id),
          message: "Please inspect the room.",
        })
      ).status,
    ).toBe(200);
    const saved = (await Complaint.findById(complaint._id))!;
    expect(saved.status).toBe("in_progress");
    expect(String(saved.assignedStaffRef)).toBe(String(staff._id));
    const history = (await Assignment.findOne({ complaintRef: complaint._id }))!;
    expect(String(history.assignedToRef)).toBe(String(staff._id));
    expect(history.reason).toBe("Please inspect the room.");
    expect((await ComplaintTimeline.findOne({ complaintRef: complaint._id }))!.toValue).toBe(
      "in_progress",
    );
  });

  it("rejects ordinary staff self-pickup", async () => {
    const { staff, complaint, assign, office } = await setup();
    mocks.auth.mockResolvedValue({
      user: { id: String(staff._id), role: "office_staff", officeRef: String(office._id) },
    });
    expect((await assign({ assignedStaffRef: String(staff._id) })).status).toBe(403);
    expect((await Complaint.findById(complaint._id))!.status).toBe("submitted");
  });
});
