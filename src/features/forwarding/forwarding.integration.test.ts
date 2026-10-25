import { beforeAll, afterAll, beforeEach, describe, it, expect, vi } from "vitest";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "mongoose";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ auth: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/db", () => ({ connectToDatabase: vi.fn() }));
vi.mock("@/lib/env", () => ({ env: { TICKET_NUMBER_PREFIX: "TEST" } }));
vi.mock("@/features/notifications/services/notification.service", () => ({
  notifyInformationRequested: vi.fn(),
  notifyInformationSubmitted: vi.fn(),
  notifyComplaintResolved: vi.fn(),
  notifyStatusUpdated: vi.fn(),
}));
import { createTestOffice, createTestUser, createTestCategory } from "@/test/fixtures";
import {
  Complaint,
  Office,
  User,
  Assignment,
  ComplaintTimeline,
  AuditLog,
  Notification,
  ForwardingRequest,
  InformationRequest,
} from "@/models";
import { changeForwarding } from "./forwarding.service";
import { POST as requestForwarding } from "@/app/api/complaints/[id]/forwarding/route";
import { PATCH as decideForwarding } from "@/app/api/forwarding-requests/[id]/route";
import { GET as detail, PATCH as updateStatus } from "@/app/api/complaints/[id]/route";
import { GET as list } from "@/app/api/complaints/route";
import { POST as addNote } from "@/app/api/complaints/[id]/notes/route";
import { POST as requestInfo } from "@/app/api/complaints/[id]/information-request/route";
import { POST as respond } from "@/app/api/complaints/[id]/information-response/route";
import { canAccessComplaint } from "@/lib/complaint-access";
import { complaintFilterForScope, getAdminScope } from "@/lib/admin-scope";
import { queryReportData } from "@/features/reports/services/report-data.service";
import { getDashboardData } from "@/features/dashboard/services/dashboard-data.service";
import { reportComplaintScope } from "@/lib/report-complaint-scope";
import { join } from "node:path";

let mongo: MongoMemoryReplSet;
beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({
    replSet: { count: 1 },
    instanceOpts: [{ args: ["--setParameter", "indexBuildMinAvailableDiskSpaceMB=128"] }],
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
});
function request(body: any, method = "POST") {
  return new NextRequest("http://localhost/api/test", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
const context = (id: any) => ({ params: Promise.resolve({ id: String(id) }) });
const session = (user: any) => ({
  user: {
    id: String(user._id),
    role: user.role,
    officeRef: user.officeRef ? String(user.officeRef) : null,
  },
});
async function setup() {
  const osas = await createTestOffice({ code: "OSAS" });
  const aaOffice = await createTestOffice({ code: "OVPAA" });
  const afOffice = await createTestOffice({ code: "OVPAF" });
  const head = await createTestUser({ role: "osas", officeRef: osas._id });
  const staff = await createTestUser({ role: "office_staff", officeRef: osas._id });
  const other = await createTestUser({ role: "office_staff", officeRef: osas._id });
  const vpaa = await createTestUser({ role: "vpaa", officeRef: aaOffice._id });
  const vpaf = await createTestUser({ role: "vpaf", officeRef: afOffice._id });
  const student = await createTestUser();
  const admin = await createTestUser({ role: "administrator" });
  await Office.updateOne({ _id: osas._id }, { headUserRef: head._id });
  await Office.updateOne({ _id: aaOffice._id }, { headUserRef: vpaa._id });
  await Office.updateOne({ _id: afOffice._id }, { headUserRef: vpaf._id });
  const category = await createTestCategory({ defaultOfficeRef: osas._id });
  const complaint = await Complaint.create({
    ticketNumber: "FORWARD-1",
    studentRef: student._id,
    categoryRef: category._id,
    title: "Private forwarding concern",
    description: "Forwarding test",
    priority: "medium",
    status: "in_progress",
    assignedOfficeRef: osas._id,
    initialOfficeRef: osas._id,
    assignedStaffRef: staff._id,
    slaResponseDueAt: new Date("2026-10-29"),
    slaResolutionDueAt: new Date("2026-10-30"),
  });
  await Assignment.create({
    complaintRef: complaint._id,
    assignedToRef: staff._id,
    assignedByRef: head._id,
    destinationOfficeRef: osas._id,
  });
  const login = (user: any) => mocks.auth.mockResolvedValue(session(user));
  return {
    osas,
    aaOffice,
    afOffice,
    head,
    staff,
    other,
    vpaa,
    vpaf,
    student,
    admin,
    complaint,
    login,
  };
}
async function forward(d: Awaited<ReturnType<typeof setup>>, destination: "vpaa" | "vpaf") {
  const pending = await changeForwarding(session(d.staff), {
    complaintId: String(d.complaint._id),
    body: { destination, reason: "Requires receiving-office review" },
  });
  await changeForwarding(session(d.head), {
    requestId: String(pending._id),
    body: { action: "approve", reason: "Within receiving-office responsibility" },
  });
  return pending;
}
describe("OSAS-controlled forwarding", () => {
  it.each(["vpaa", "vpaf"] as const)(
    "denies %s unforwarded details, lists, counts, reports and legacy direct routing",
    async (role) => {
      const d = await setup();
      d.login(d[role]);
      expect((await detail(request({}, "PATCH"), context(d.complaint._id))).status).toBe(403);
      const listed = await (
        await list(new NextRequest("http://localhost/api/complaints?q=Private"))
      ).json();
      expect(listed.total).toBe(0);
      expect((await getDashboardData(session(d[role]) as any)).summary.totalComplaints).toBe(0);
      expect(
        await queryReportData({}, await complaintFilterForScope(getAdminScope(role))),
      ).toHaveLength(0);
      d.complaint.assignedOfficeRef = role === "vpaa" ? d.aaOffice._id : d.afOffice._id;
      await d.complaint.save();
      expect(await canAccessComplaint(session(d[role]), d.complaint)).toBe(false);
    },
  );
  it("requests without moving ownership or granting visibility, notifying only OSAS Head", async () => {
    const d = await setup();
    d.login(d.staff);
    const response = await requestForwarding(
      request({ destination: "vpaa", reason: "Academic review needed" }),
      context(d.complaint._id),
    );
    expect(response.status).toBe(201);
    expect(await ForwardingRequest.countDocuments({ status: "pending" })).toBe(1);
    const saved = (await Complaint.findById(d.complaint._id))!;
    expect(String(saved.assignedOfficeRef)).toBe(String(d.osas._id));
    expect(String(saved.assignedStaffRef)).toBe(String(d.staff._id));
    expect(await canAccessComplaint(session(d.vpaa), saved)).toBe(false);
    expect(await Notification.countDocuments({ userRef: d.head._id })).toBe(1);
    expect(await Notification.countDocuments({ userRef: d.vpaa._id })).toBe(0);
  });
  it("blocks direct staff forwarding, self-approval, unrelated handlers, and main admin forwarding", async () => {
    const d = await setup();
    d.login(d.staff);
    expect(
      (
        await requestForwarding(
          request({ destination: "vpaa", reason: "Review", direct: true }),
          context(d.complaint._id),
        )
      ).status,
    ).toBe(403);
    const pending = await changeForwarding(session(d.staff), {
      complaintId: String(d.complaint._id),
      body: { destination: "vpaa", reason: "Review" },
    });
    for (const user of [d.staff, d.other, d.admin, d.vpaa]) {
      d.login(user);
      expect(
        (await decideForwarding(request({ action: "approve" }, "PATCH"), context(pending._id)))
          .status,
      ).toBe(403);
    }
    expect((await ForwardingRequest.findById(pending._id))!.status).toBe("pending");
  });
  it("rejects with a reason and preserves the existing office and handler", async () => {
    const d = await setup();
    const pending = await changeForwarding(session(d.staff), {
      complaintId: String(d.complaint._id),
      body: { destination: "vpaf", reason: "Finance review" },
    });
    await expect(
      changeForwarding(session(d.head), {
        requestId: String(pending._id),
        body: { action: "reject" },
      }),
    ).rejects.toThrow("reason");
    await changeForwarding(session(d.head), {
      requestId: String(pending._id),
      body: { action: "reject", reason: "OSAS can resolve this concern" },
    });
    const saved = (await Complaint.findById(d.complaint._id))!;
    expect(String(saved.assignedOfficeRef)).toBe(String(d.osas._id));
    expect(String(saved.assignedStaffRef)).toBe(String(d.staff._id));
    expect(await ComplaintTimeline.countDocuments({ eventType: "forwarding_rejected" })).toBe(1);
    expect(await Notification.countDocuments({ userRef: d.staff._id })).toBe(1);
  });
  it.each(["vpaa", "vpaf"] as const)(
    "forwards to %s exclusively, retaining SLA and history, then supports information, notes and resolution",
    async (role) => {
      const d = await setup();
      await forward(d, role);
      const receiver = d[role],
        otherReceiver = role === "vpaa" ? d.vpaf : d.vpaa;
      let saved = (await Complaint.findById(d.complaint._id))!;
      expect(String(saved.assignedStaffRef)).toBe(String(receiver._id));
      expect(saved.forwardedToRole).toBe(role);
      expect(saved.slaResolutionDueAt).toEqual(d.complaint.slaResolutionDueAt);
      expect(saved.slaResponseDueAt).toEqual(d.complaint.slaResponseDueAt);
      expect(saved.submittedAt).toEqual(d.complaint.submittedAt);
      expect(await canAccessComplaint(session(receiver), saved)).toBe(true);
      expect(await canAccessComplaint(session(otherReceiver), saved)).toBe(false);
      expect(await canAccessComplaint(session(d.staff), saved)).toBe(false);
      expect(await canAccessComplaint(session(d.admin), saved)).toBe(true);
      expect(await Assignment.countDocuments({ complaintRef: saved._id })).toBe(2);
      expect(await AuditLog.countDocuments({ action: "complaint.forwarded" })).toBe(1);
      expect(await Notification.countDocuments({ userRef: receiver._id })).toBe(1);
      expect(await queryReportData({}, await reportComplaintScope(session(d.head)))).toHaveLength(
        1,
      );
      expect(
        await queryReportData({}, await reportComplaintScope(session(otherReceiver))),
      ).toHaveLength(0);
      d.login(receiver);
      expect(
        (await addNote(request({ body: "Receiving office note" }), context(saved._id))).status,
      ).toBe(201);
      expect(
        (
          await requestInfo(
            request({ requestMessage: "Please provide the reference number." }),
            context(saved._id),
          )
        ).status,
      ).toBe(201);
      d.login(d.student);
      expect(
        (
          await respond(
            request({ responseMessage: "Reference number STUDENT-100", attachmentIds: [] }),
            context(saved._id),
          )
        ).status,
      ).toBe(200);
      saved = (await Complaint.findById(saved._id))!;
      expect(saved.status).toBe("in_progress");
      expect(String(saved.assignedStaffRef)).toBe(String(receiver._id));
      d.login(receiver);
      expect(
        (
          await updateStatus(
            request(
              { status: "resolved", resolutionSummary: "Concern addressed by receiving office." },
              "PATCH",
            ),
            context(saved._id),
          )
        ).status,
      ).toBe(200);
      d.login(otherReceiver);
      expect(
        (await updateStatus(request({ status: "resolved" }, "PATCH"), context(saved._id))).status,
      ).toBe(403);
      expect(await InformationRequest.countDocuments({ status: "responded" })).toBe(1);
    },
  );
  it("enforces one pending request even under concurrent submissions", async () => {
    const d = await setup();
    const outcomes = await Promise.allSettled(
      ["vpaa", "vpaf"].map((destination) =>
        changeForwarding(session(d.staff), {
          complaintId: String(d.complaint._id),
          body: { destination, reason: "Concurrent request" },
        }),
      ),
    );
    expect(outcomes.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(await ForwardingRequest.countDocuments({ status: "pending" })).toBe(1);
  });
  it("keeps an outstanding information request open across forwarding and resumes in the receiving office", async () => {
    const d = await setup();
    d.login(d.staff);
    expect(
      (
        await requestInfo(
          request({ requestMessage: "Provide supporting documents." }),
          context(d.complaint._id),
        )
      ).status,
    ).toBe(201);
    await forward(d, "vpaa");
    expect((await Complaint.findById(d.complaint._id))!.status).toBe("pending_information");
    d.login(d.student);
    expect(
      (
        await respond(
          request({ responseMessage: "Supporting reference ABC-123", attachmentIds: [] }),
          context(d.complaint._id),
        )
      ).status,
    ).toBe(200);
    const saved = (await Complaint.findById(d.complaint._id))!;
    expect(saved.status).toBe("in_progress");
    expect(String(saved.assignedStaffRef)).toBe(String(d.vpaa._id));
  });
  it("uses office head membership instead of the OSAS role label to authorize approval", async () => {
    const d = await setup();
    const pending = await changeForwarding(session(d.head), {
      complaintId: String(d.complaint._id),
      body: { destination: "vpaa", reason: "Academic review" },
    });
    await Office.updateOne({ _id: d.osas._id }, { headUserRef: d.other._id });
    await expect(
      changeForwarding(session(d.head), {
        requestId: String(pending._id),
        body: { action: "approve" },
      }),
    ).rejects.toThrow("Only the OSAS Office Head");
    expect(
      (
        await changeForwarding(session(d.other), {
          requestId: String(pending._id),
          body: { action: "approve" },
        })
      ).status,
    ).toBe("approved");
  });
  it("allows direct head forwarding, validates destinations, and prevents repeated approval or return", async () => {
    const d = await setup();
    d.login(d.head);
    expect(
      (
        await requestForwarding(
          request({ destination: "icto", reason: "No arbitrary offices" }),
          context(d.complaint._id),
        )
      ).status,
    ).toBe(400);
    const approved = await changeForwarding(session(d.head), {
      complaintId: String(d.complaint._id),
      body: { destination: "vpaf", reason: "Administrative responsibility", direct: true },
    });
    expect(approved.status).toBe("approved");
    await expect(
      changeForwarding(session(d.head), {
        requestId: String(approved._id),
        body: { action: "approve" },
      }),
    ).rejects.toThrow();
    await expect(
      changeForwarding(session(d.vpaf), {
        complaintId: String(d.complaint._id),
        body: { destination: "vpaa", reason: "Return" },
      }),
    ).rejects.toThrow();
    expect(await Assignment.countDocuments({ actionType: "forward" })).toBe(1);
  });
  it("rolls back a decision when the receiving account is unavailable", async () => {
    const d = await setup();
    const pending = await changeForwarding(session(d.staff), {
      complaintId: String(d.complaint._id),
      body: { destination: "vpaa", reason: "Review" },
    });
    await User.updateOne({ _id: d.vpaa._id }, { isActive: false });
    await expect(
      changeForwarding(session(d.head), {
        requestId: String(pending._id),
        body: { action: "approve" },
      }),
    ).rejects.toThrow("Configure");
    expect((await ForwardingRequest.findById(pending._id))!.status).toBe("pending");
    expect(await Assignment.countDocuments({ actionType: "forward" })).toBe(0);
    expect((await Complaint.findById(d.complaint._id))!.forwardedAt).toBeNull();
  });
  it("migrates legacy development ownership without moving approved forwarding or deleting history", async () => {
    const d = await setup();
    await forward(d, "vpaa");
    const legacyOffice = await createTestOffice({ code: "ICTO" });
    const legacy = await Complaint.create({
      ticketNumber: "LEGACY",
      studentRef: d.student._id,
      categoryRef: d.complaint.categoryRef,
      title: "Legacy active complaint",
      description: "Preserve this record",
      priority: "medium",
      status: "submitted",
      assignedOfficeRef: legacyOffice._id,
    });
    const { migrateForwarding } = await import("../../../scripts/migrate-forwarding.cjs");
    const preview = await migrateForwarding(mongoose.connection.db!);
    expect(preview.routing.activeComplaintsToMigrate).toBe(1);
    expect(String((await Complaint.findById(legacy._id))!.assignedOfficeRef)).toBe(
      String(legacyOffice._id),
    );
    await migrateForwarding(mongoose.connection.db!, {
      apply: true,
      backupDirectory: join(
        process.cwd(),
        ".local-backups",
        `forwarding-migration-test-${Date.now()}`,
      ),
    });
    expect(String((await Complaint.findById(legacy._id))!.assignedOfficeRef)).toBe(
      String(d.osas._id),
    );
    expect(String((await Complaint.findById(d.complaint._id))!.assignedOfficeRef)).toBe(
      String(d.aaOffice._id),
    );
    expect(await ForwardingRequest.countDocuments({ status: "approved" })).toBe(1);
    expect(
      (await migrateForwarding(mongoose.connection.db!)).routing.activeComplaintsToMigrate,
    ).toBe(0);
  });
});
