import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { Types } from "mongoose";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  findById: vi.fn(),
  timeline: vi.fn(),
  audit: vi.fn(),
  notify: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/db", () => ({ connectToDatabase: vi.fn() }));
vi.mock("@/lib/osas-operations", () => ({
  canProcessComplaint: async (s: any, c: any) => s.user.officeRef === c.assignedOfficeRef,
}));
vi.mock("@/lib/complaint-access", () => ({ canAccessComplaint: async () => true }));
vi.mock("@/models/Complaint", () => ({ Complaint: { findById: mocks.findById } }));
vi.mock("@/models/ComplaintTimeline", () => ({ ComplaintTimeline: { create: mocks.timeline } }));
vi.mock("@/features/audit-log/services/audit-log.service", () => ({ writeAuditLog: mocks.audit }));
vi.mock("@/features/notifications/services/notification.service", () => ({
  notifyComplaintResolved: mocks.notify,
  notifyStatusUpdated: vi.fn(),
}));
vi.mock("@/lib/admin-scope", () => ({ getAdminScope: vi.fn(), isComplaintInAdminScope: vi.fn() }));
vi.mock("@/lib/osas-complaint-scope", () => ({ isComplaintInOsasActionScope: vi.fn() }));

import { PATCH } from "./route";

const staffId = new Types.ObjectId().toString();
const officeId = new Types.ObjectId().toString();
let complaint: ReturnType<typeof makeComplaint>;
function makeComplaint() {
  return {
    _id: new Types.ObjectId(),
    studentRef: new Types.ObjectId(),
    ticketNumber: "TEST-RESOLUTION",
    status: "in_progress",
    assignedOfficeRef: officeId,
    assignedStaffRef: staffId,
    isArchived: false,
    resolutionSummary: "",
    resolvedAt: null as Date | null,
    resolvedByRef: null as Types.ObjectId | null,
    save: vi.fn(),
  };
}
function update(body: Record<string, unknown>) {
  return PATCH(
    new NextRequest("http://localhost/api/complaints/test", {
      method: "PATCH",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    }),
    { params: Promise.resolve({ id: complaint._id.toString() }) },
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  complaint = makeComplaint();
  mocks.findById.mockResolvedValue(complaint);
  mocks.auth.mockResolvedValue({
    user: { id: staffId, role: "office_staff", officeRef: officeId },
  });
});

describe("complaint resolution", () => {
  it.each(["submitted", "escalated"])(
    "requires the assignment workflow to mark %s complaints assigned",
    async (status) => {
      complaint.status = status;
      const response = await update({ status: "assigned" });
      expect(response.status).toBe(400);
      expect((await response.json()).error).toContain("select a staff member");
      expect(complaint.save).not.toHaveBeenCalled();
      expect(mocks.timeline).not.toHaveBeenCalled();
    },
  );
  it.each([undefined, "", " \n "])(
    "allows resolution without details",
    async (resolutionSummary) => {
      complaint.resolutionSummary = "Previous repair.";
      const response = await update({ status: "resolved", resolutionSummary });
      expect(response.status).toBe(200);
      expect(complaint.resolutionSummary).toBe("");
      expect(complaint.save).toHaveBeenCalled();
      expect(mocks.timeline).toHaveBeenCalledWith(
        expect.objectContaining({ toValue: "resolved", resolutionSummary: "" }),
      );
    },
  );

  it.each(["x".repeat(4001)])("rejects excessive details", async (resolutionSummary) => {
    const response = await update({ status: "resolved", resolutionSummary });
    expect(response.status).toBe(400);
    expect((await response.json()).fieldErrors.resolutionSummary).toBeDefined();
    expect(complaint.save).not.toHaveBeenCalled();
    expect(mocks.timeline).not.toHaveBeenCalled();
  });

  it("saves trimmed details, resolver, timestamp and a separate optional note", async () => {
    const response = await update({
      status: "resolved",
      resolutionSummary: "  Replaced lamp.\nVerified operation.  ",
      message: "Student informed.",
    });
    expect(response.status).toBe(200);
    expect(complaint.resolutionSummary).toBe("Replaced lamp.\nVerified operation.");
    expect(complaint.resolvedByRef?.toString()).toBe(staffId);
    expect(complaint.resolvedAt).toBeInstanceOf(Date);
    expect(mocks.timeline).toHaveBeenCalledWith(
      expect.objectContaining({
        toValue: "resolved",
        resolutionSummary: complaint.resolutionSummary,
        message: "Student informed.",
      }),
    );
    expect(mocks.audit).toHaveBeenCalledWith(
      expect.objectContaining({
        afterState: { status: "resolved", resolutionSummary: complaint.resolutionSummary },
      }),
    );
  });

  it("preserves the earlier timeline record when resolving again", async () => {
    await update({ status: "resolved", resolutionSummary: "Initial repair." });
    const firstEvent = mocks.timeline.mock.calls[0]![0];
    complaint.status = "in_progress"; // State restored by the dedicated reopen workflow.
    const previousDate = new Date("2020-01-01");
    complaint.resolvedAt = previousDate;
    expect(
      (await update({ status: "resolved", resolutionSummary: "Replaced faulty unit." })).status,
    ).toBe(200);
    expect(firstEvent.resolutionSummary).toBe("Initial repair.");
    expect(mocks.timeline.mock.calls[1]![0].resolutionSummary).toBe("Replaced faulty unit.");
    expect(complaint.resolvedAt!.getTime()).toBeGreaterThan(previousDate.getTime());
  });

  it("does not allow another status update to overwrite resolution details", async () => {
    complaint.status = "assigned";
    complaint.resolutionSummary = "Previous repair.";
    expect((await update({ status: "in_progress", resolutionSummary: "Overwrite" })).status).toBe(
      200,
    );
    expect(complaint.resolutionSummary).toBe("Previous repair.");
  });

  it("keeps archived complaints read-only", async () => {
    complaint.isArchived = true;
    expect((await update({ status: "resolved", resolutionSummary: "Repair." })).status).toBe(403);
    expect(complaint.save).not.toHaveBeenCalled();
  });

  it("rejects staff from a different office", async () => {
    mocks.auth.mockResolvedValue({
      user: { id: staffId, role: "office_staff", officeRef: "another-office" },
    });
    expect((await update({ status: "resolved", resolutionSummary: "Repair." })).status).toBe(403);
    expect(complaint.save).not.toHaveBeenCalled();
  });
});
