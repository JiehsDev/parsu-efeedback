import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { Complaint, ComplaintTimeline, Office, ResolutionRequest } from "@/models";
import { createTestCategory, createTestOffice, createTestUser } from "@/test/fixtures";
import { POST as requestResolution } from "@/app/api/complaints/[id]/resolution-requests/route";
import { PATCH as decideResolution } from "@/app/api/resolution-requests/[id]/route";
import { GET as readComplaint } from "@/app/api/complaints/[id]/route";

const mocks = vi.hoisted(() => ({ auth: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/db", () => ({ connectToDatabase: vi.fn() }));
vi.mock("@/features/audit-log/services/audit-log.service", () => ({ writeAuditLog: vi.fn() }));
vi.mock("@/features/notifications/services/notification.service", () => ({
  notifyResolutionRequest: vi.fn(),
  notifyResolutionDecision: vi.fn(),
  notifyComplaintResolved: vi.fn(),
}));

let mongo: MongoMemoryReplSet;
beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({
    replSet: { count: 1 },
    instanceOpts: [{ args: ["--setParameter", `indexBuildMinAvailableDiskSpaceMB=${process.env.MONGO_TEST_MIN_DISK_MB ?? "128"}`] }],
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
  user: { id: String(user._id), role: user.role, officeRef: String(user.officeRef) },
});
const context = (id: unknown) => ({ params: Promise.resolve({ id: String(id) }) });
const request = (body: any, url = "http://localhost/api/test") =>
  new NextRequest(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

async function setup() {
  const office = await createTestOffice({ code: "OSAS" });
  const head = await createTestUser({ role: "office_staff", officeRef: office._id });
  const staff = await createTestUser({ role: "office_staff", officeRef: office._id });
  const student = await createTestUser();
  await Office.updateOne({ _id: office._id }, { headUserRef: head._id });
  const category = await createTestCategory({ defaultOfficeRef: office._id });
  const complaint = await Complaint.create({
    ticketNumber: "RESOLUTION-APPROVAL-1",
    studentRef: student._id,
    categoryRef: category._id,
    title: "Resolve after approval",
    description: "The resolution should not take effect before the office head approves it.",
    priority: "medium",
    status: "in_progress",
    assignedOfficeRef: office._id,
    initialOfficeRef: office._id,
    assignedStaffRef: staff._id,
    slaResponseDueAt: new Date("2026-12-01"),
    slaResolutionDueAt: new Date("2026-12-04"),
  });
  return { office, head, staff, student, complaint };
}

describe("staff resolution approval workflow", () => {
  it("keeps the complaint active until the designated head approves, then resolves as the staff member", async () => {
    const d = await setup();
    mocks.auth.mockResolvedValue(session(d.staff));
    const submitResponse = await requestResolution(
      request({ resolutionSummary: "Repaired and verified.", message: "Please review the completed work." }),
      context(d.complaint._id),
    );
    expect(submitResponse.status).toBe(201);
    const pending = (await submitResponse.json()).request;
    const waiting = await Complaint.findById(d.complaint._id);
    expect(waiting?.status).toBe("in_progress");
    expect(waiting?.resolvedAt).toBeNull();
    expect(waiting?.resolvedByRef).toBeNull();
    expect(await ComplaintTimeline.exists({ complaintRef: d.complaint._id, eventType: "resolution_requested" })).toBeTruthy();
    mocks.auth.mockResolvedValue(session(d.student));
    const studentView = await readComplaint(
      new NextRequest("http://localhost/api/complaints/test"),
      context(d.complaint._id),
    );
    expect((await studentView.json()).timeline).toEqual([]);

    mocks.auth.mockResolvedValue(session(d.head));
    const approveResponse = await decideResolution(
      request({ action: "approve" }, "http://localhost/api/resolution-requests/test"),
      context(pending._id),
    );
    expect(approveResponse.status).toBe(200);
    const resolved = await Complaint.findById(d.complaint._id);
    expect(resolved?.status).toBe("resolved");
    expect(String(resolved?.resolvedByRef)).toBe(String(d.staff._id));
    expect(resolved?.resolutionSummary).toBe("Repaired and verified.");
    expect(resolved?.slaResolutionDueAt?.getTime()).toBe(d.complaint.slaResolutionDueAt!.getTime());
    expect((await ResolutionRequest.findById(pending._id))?.status).toBe("approved");
  });

  it("rejects direct staff resolution and requires a reason when returning a request", async () => {
    const d = await setup();
    mocks.auth.mockResolvedValue(session(d.staff));
    const body = { resolutionSummary: "Attempted repair." };
    const submitted = await requestResolution(request(body), context(d.complaint._id));
    const pending = (await submitted.json()).request;
    const duplicate = await requestResolution(request(body), context(d.complaint._id));
    expect(duplicate.status).toBe(409);

    mocks.auth.mockResolvedValue(session(d.head));
    const missingReason = await decideResolution(
      request({ action: "reject" }, "http://localhost/api/resolution-requests/test"),
      context(pending._id),
    );
    expect(missingReason.status).toBe(400);
    const rejected = await decideResolution(
      request({ action: "reject", rejectionReason: "Please verify the repair with the student." }, "http://localhost/api/resolution-requests/test"),
      context(pending._id),
    );
    expect(rejected.status).toBe(200);
    expect((await Complaint.findById(d.complaint._id))?.status).toBe("in_progress");
    expect((await ResolutionRequest.findById(pending._id))?.status).toBe("rejected");
  });

  it("does not let another office staff member approve the request", async () => {
    const d = await setup();
    const colleague = await createTestUser({ role: "office_staff", officeRef: d.office._id });
    mocks.auth.mockResolvedValue(session(d.staff));
    const submitted = await requestResolution(request({}), context(d.complaint._id));
    const pending = (await submitted.json()).request;
    mocks.auth.mockResolvedValue(session(colleague));
    const response = await decideResolution(
      request({ action: "approve" }, "http://localhost/api/resolution-requests/test"),
      context(pending._id),
    );
    expect(response.status).toBe(403);
    expect((await Complaint.findById(d.complaint._id))?.status).toBe("in_progress");
  });
});
