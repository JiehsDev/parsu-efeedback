import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ auth: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/db", () => ({ connectToDatabase: vi.fn() }));
vi.mock("@/features/audit-log/services/audit-log.service", () => ({ writeAuditLog: vi.fn() }));
vi.mock("@/features/notifications/services/notification.service", () => ({
  notifyDismissalRequested: vi.fn(),
  notifyDismissalDecision: vi.fn(),
  notifyComplaintDismissed: vi.fn(),
  notifyComplaintReopened: vi.fn(),
}));

import { createTestOffice, createTestUser, createTestCategory } from "@/test/fixtures";
import { Complaint } from "@/models/Complaint";
import { ComplaintTimeline } from "@/models/ComplaintTimeline";
import { DismissalRequest } from "@/models/DismissalRequest";
import { Office } from "@/models/Office";
import { POST as requestDismissal } from "@/app/api/complaints/[id]/dismissal-requests/route";
import { PATCH as decideDismissal } from "@/app/api/dismissal-requests/[id]/route";
import { POST as dismissDirectly } from "@/app/api/complaints/[id]/dismiss/route";
import { POST as reopen } from "@/app/api/complaints/[id]/reopen/route";

let mongo: MongoMemoryReplSet;
beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({
    replSet: { count: 1 },
    instanceOpts: [
      {
        args: [
          "--setParameter",
          `indexBuildMinAvailableDiskSpaceMB=${process.env.MONGO_TEST_MIN_DISK_MB ?? "128"}`,
        ],
      },
    ],
  });
  await mongoose.connect(mongo.getUri());
  await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
}, 90000);
afterAll(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});
beforeEach(async () => {
  for (const collection of Object.values(mongoose.connection.collections))
    await collection.deleteMany({});
  vi.clearAllMocks();
});

const session = (user: any) => ({
  user: {
    id: String(user._id),
    role: user.role,
    officeRef: user.officeRef ? String(user.officeRef) : null,
  },
});
const context = (id: unknown) => ({ params: Promise.resolve({ id: String(id) }) });
const request = (body: Record<string, unknown>) =>
  new NextRequest("http://localhost/api/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
const decision = (body: Record<string, unknown>) =>
  new NextRequest("http://localhost/api/test", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
const reason = {
  reasonCode: "duplicate",
  reasonText: "This concern duplicates an earlier complaint.",
};

async function setup(code: "OSAS" | "OVPAA" = "OSAS") {
  const office = await createTestOffice({ code });
  const otherOffice = await createTestOffice({ code: "OVPAF" });
  const head = await createTestUser({
    role: code === "OSAS" ? "osas" : "vpaa",
    officeRef: office._id,
  });
  const staff = await createTestUser({ role: "office_staff", officeRef: office._id });
  const outsider = await createTestUser({ role: "vpaf", officeRef: otherOffice._id });
  const student = await createTestUser();
  await Office.updateOne({ _id: office._id }, { headUserRef: head._id });
  await Office.updateOne({ _id: otherOffice._id }, { headUserRef: outsider._id });
  const category = await createTestCategory({ defaultOfficeRef: office._id });
  const complaint = await Complaint.create({
    ticketNumber: `DISMISS-${code}`,
    studentRef: student._id,
    categoryRef: category._id,
    title: "Duplicate concern",
    description: "A duplicate complaint requiring review.",
    priority: "medium",
    status: "in_progress",
    assignedOfficeRef: office._id,
    assignedStaffRef: staff._id,
    ...(code === "OVPAA" ? { forwardedToRole: "vpaa", forwardedAt: new Date() } : {}),
  });
  const login = (user: any) => mocks.auth.mockResolvedValue(session(user));
  return { office, head, staff, outsider, student, complaint, login };
}

describe.each(["OSAS", "OVPAA"] as const)("%s dismissal approval", (code) => {
  it("keeps the complaint active until its current office head approves, then records the student-facing reason", async () => {
    const d = await setup(code);
    d.login(d.staff);
    const submitted = await requestDismissal(
      request({ ...reason, internalNote: "Compare submission dates." }),
      context(d.complaint._id),
    );
    expect(submitted.status).toBe(201);
    expect((await Complaint.findById(d.complaint._id))!.status).toBe("in_progress");
    const id = (await submitted.json()).request._id;
    expect((await requestDismissal(request(reason), context(d.complaint._id))).status).toBe(409);
    d.login(d.outsider);
    expect((await decideDismissal(decision({ action: "approve" }), context(id))).status).toBe(403);
    d.login(d.head);
    expect((await decideDismissal(decision({ action: "approve" }), context(id))).status).toBe(200);
    const saved = (await Complaint.findById(d.complaint._id))!;
    expect(saved.status).toBe("dismissed");
    expect(saved.dismissalReason).toBe(reason.reasonText);
    expect(saved.dismissedAt).toBeInstanceOf(Date);
    expect(String(saved.dismissedByRef)).toBe(String(d.head._id));
    expect((await DismissalRequest.findById(id))!.status).toBe("approved");
    expect(
      await ComplaintTimeline.countDocuments({ complaintRef: saved._id, eventType: "dismissed" }),
    ).toBe(1);
    expect((await decideDismissal(decision({ action: "approve" }), context(id))).status).toBe(409);
  });
});

describe("dismissal safeguards", () => {
  it("requires an explanation and keeps a rejected complaint active", async () => {
    const d = await setup();
    d.login(d.staff);
    expect(
      (
        await requestDismissal(
          request({ reasonCode: "other", reasonText: "short" }),
          context(d.complaint._id),
        )
      ).status,
    ).toBe(400);
    const submitted = await requestDismissal(request(reason), context(d.complaint._id));
    const id = (await submitted.json()).request._id;
    d.login(d.head);
    expect((await decideDismissal(decision({ action: "reject" }), context(id))).status).toBe(400);
    expect(
      (
        await decideDismissal(
          decision({ action: "reject", rejectionReason: "Needs further review." }),
          context(id),
        )
      ).status,
    ).toBe(200);
    expect((await Complaint.findById(d.complaint._id))!.status).toBe("in_progress");
  });

  it("rejects stale approval after reassignment", async () => {
    const d = await setup();
    d.login(d.staff);
    const submitted = await requestDismissal(request(reason), context(d.complaint._id));
    const id = (await submitted.json()).request._id;
    const replacement = await createTestUser({ role: "office_staff", officeRef: d.office._id });
    await Complaint.updateOne({ _id: d.complaint._id }, { assignedStaffRef: replacement._id });
    d.login(d.head);
    expect((await decideDismissal(decision({ action: "approve" }), context(id))).status).toBe(409);
    expect((await Complaint.findById(d.complaint._id))!.status).toBe("in_progress");
  });

  it("allows a head to dismiss directly and reopen with an audited reason", async () => {
    const d = await setup();
    d.login(d.head);
    expect((await dismissDirectly(request(reason), context(d.complaint._id))).status).toBe(200);
    expect((await Complaint.findById(d.complaint._id))!.status).toBe("dismissed");
    expect(
      (
        await reopen(
          request({ reason: "New evidence establishes that this concern needs action." }),
          context(d.complaint._id),
        )
      ).status,
    ).toBe(200);
    const reopened = (await Complaint.findById(d.complaint._id))!;
    expect(reopened.status).toBe("assigned");
    expect(reopened.firstResponseAt).toBeNull();
    expect(reopened.dismissalReason).toBe("");
    expect(
      await ComplaintTimeline.countDocuments({
        complaintRef: d.complaint._id,
        eventType: "reopened",
      }),
    ).toBe(1);
  });
});
