import { beforeAll, afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ auth: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/db", () => ({ connectToDatabase: vi.fn() }));
vi.mock("@/lib/env", () => ({ env: {} }));
vi.mock("@/features/audit-log/services/audit-log.service", () => ({ writeAuditLog: vi.fn() }));
vi.mock("@/features/notifications/services/notification.service", () => ({
  notifyComplaintAssigned: vi.fn(),
  notifyInformationRequested: vi.fn(),
  notifyInformationSubmitted: vi.fn(),
  notifyStatusUpdated: vi.fn(),
  notifyComplaintResolved: vi.fn(),
  notifyManualEscalation: vi.fn(),
}));
import { Complaint, Office, Assignment, ForwardingRequest, User } from "@/models";
import { createTestOffice, createTestUser, createTestCategory } from "@/test/fixtures";
import { canProcessComplaint, staffComplaintFilter } from "@/lib/osas-operations";
import { canAccessComplaint, canAttachToComplaint } from "@/lib/complaint-access";
import {
  changeForwarding,
  forwardingHistoryFilter,
} from "@/features/forwarding/forwarding.service";
import { POST as assign } from "@/app/api/complaints/[id]/assign/route";
import { GET as roster } from "@/app/api/offices/[id]/staff/route";
import { GET as list } from "@/app/api/complaints/route";
import { PATCH as updateStatus } from "@/app/api/complaints/[id]/route";
import { POST as addNote } from "@/app/api/complaints/[id]/notes/route";
import { POST as requestInformation } from "@/app/api/complaints/[id]/information-request/route";
import { POST as respondInformation } from "@/app/api/complaints/[id]/information-response/route";
import { POST as requestReview } from "@/app/api/complaints/[id]/escalate/route";
import { getDashboardData } from "@/features/dashboard/services/dashboard-data.service";
import { queryReportData } from "@/features/reports/services/report-data.service";
import { reportComplaintScope } from "@/lib/report-complaint-scope";
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
const context = (id: any) => ({ params: Promise.resolve({ id: String(id) }) });
const request = (body: any = {}, method = "POST") =>
  new NextRequest("http://localhost/api/test", {
    method,
    ...(method === "GET"
      ? {}
      : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
  });
async function setup(role: "vpaa" | "vpaf") {
  const osas = await createTestOffice({ code: "OSAS" });
  const office = await createTestOffice({ code: role === "vpaa" ? "OVPAA" : "OVPAF" });
  const otherOffice = await createTestOffice({ code: role === "vpaa" ? "OVPAF" : "OVPAA" });
  const head = await createTestUser({ role: "osas", officeRef: osas._id });
  const osasStaff = await createTestUser({ role: "office_staff", officeRef: osas._id });
  const receivingHead = await createTestUser({ role, officeRef: office._id });
  const staff = await createTestUser({ role: "office_staff", officeRef: office._id });
  const coworker = await createTestUser({ role: "office_staff", officeRef: office._id });
  const outsider = await createTestUser({ role: "office_staff", officeRef: otherOffice._id });
  const student = await createTestUser();
  await Office.updateOne({ _id: osas._id }, { headUserRef: head._id });
  await Office.updateOne({ _id: office._id }, { headUserRef: receivingHead._id });
  const category = await createTestCategory({ group: role, defaultOfficeRef: osas._id });
  const complaint = await Complaint.create({
    ticketNumber: "RECEIVING-STAFF-1",
    studentRef: student._id,
    categoryRef: category._id,
    title: "Staff processing concern",
    description: "Office staff handling and permissions test.",
    priority: "medium",
    status: "in_progress",
    assignedOfficeRef: osas._id,
    initialOfficeRef: osas._id,
    assignedStaffRef: osasStaff._id,
    slaResponseDueAt: new Date("2026-11-06"),
    slaResolutionDueAt: new Date("2026-11-09"),
  });
  const forward = async () => {
    const pending = await changeForwarding(session(osasStaff), {
      complaintId: String(complaint._id),
      body: { destination: role, reason: "Requires the receiving office's service." },
    });
    await changeForwarding(session(head), {
      requestId: String(pending._id),
      body: { action: "approve", reason: "Approved by the designated OSAS head." },
    });
    return (await Complaint.findById(complaint._id))!;
  };
  const login = (user: any) => mocks.auth.mockResolvedValue(session(user));
  return {
    osas,
    office,
    otherOffice,
    head,
    osasStaff,
    receivingHead,
    staff,
    coworker,
    outsider,
    student,
    complaint,
    forward,
    login,
  };
}
describe.each(["vpaa", "vpaf"] as const)("%s receiving staff", (role) => {
  it("receives head assignment, reads its own forwarded office queue, and processes notes, information, attachments, and resolution without changing SLA or ownership", async () => {
    const d = await setup(role);
    expect(await canAccessComplaint(session(d.staff), d.complaint)).toBe(false);
    const forwarded = await d.forward();
    const preserved = {
      submittedAt: forwarded.submittedAt,
      initialOfficeRef: String(forwarded.initialOfficeRef),
      forwardedAt: forwarded.forwardedAt,
      slaResponseDueAt: forwarded.slaResponseDueAt,
      slaResolutionDueAt: forwarded.slaResolutionDueAt,
    };
    d.login(d.receivingHead);
    const members = await (await roster(request({}, "GET"), context(d.office._id))).json();
    expect(members.staff.map((user: any) => user._id).sort()).toEqual(
      [String(d.staff._id), String(d.coworker._id)].sort(),
    );
    expect(
      (
        await assign(
          request({
            assignedStaffRef: String(d.staff._id),
            message: "Handle the forwarded service concern.",
          }),
          context(d.complaint._id),
        )
      ).status,
    ).toBe(200);
    d.login(d.staff);
    const saved = (await Complaint.findById(d.complaint._id))!;
    expect(await canProcessComplaint(session(d.staff), saved)).toBe(true);
    expect(await canAttachToComplaint(session(d.staff), saved)).toBe(true);
    expect((await (await list(request({}, "GET"))).json()).total).toBe(1);
    const dashboard = await getDashboardData(session(d.staff) as any);
    expect(dashboard.summary.totalComplaints).toBe(1);
    expect(dashboard.forwardingStats).toBeNull();
    expect(dashboard.receivingOffice).toBe(true);
    expect(await queryReportData({}, await reportComplaintScope(session(d.staff)))).toHaveLength(1);
    expect(
      (
        await addNote(
          request({ body: "Review completed by the assigned receiving office staff member." }),
          context(saved._id),
        )
      ).status,
    ).toBe(201);
    expect(
      (
        await requestInformation(
          request({ requestMessage: "Please provide supporting details for this concern." }),
          context(saved._id),
        )
      ).status,
    ).toBe(201);
    d.login(d.student);
    expect(
      (
        await respondInformation(
          request({ responseMessage: "Here are the additional details requested for review." }),
          context(saved._id),
        )
      ).status,
    ).toBe(200);
    d.login(d.staff);
    expect(
      (
        await updateStatus(
          request(
            {
              status: "resolved",
              resolutionSummary:
                "The receiving office reviewed the supporting details and resolved the concern.",
            },
            "PATCH",
          ),
          context(saved._id),
        )
      ).status,
    ).toBe(200);
    const resolved = (await Complaint.findById(saved._id))!;
    expect(resolved.status).toBe("resolved");
    expect(String(resolved.resolvedByRef)).toBe(String(d.staff._id));
    expect(String(resolved.assignedOfficeRef)).toBe(String(d.office._id));
    expect({
      submittedAt: resolved.submittedAt,
      initialOfficeRef: String(resolved.initialOfficeRef),
      forwardedAt: resolved.forwardedAt,
      slaResponseDueAt: resolved.slaResponseDueAt,
      slaResolutionDueAt: resolved.slaResolutionDueAt,
    }).toEqual(preserved);
    expect(
      await Assignment.countDocuments({
        complaintRef: saved._id,
        assignedToRef: d.staff._id,
        destinationOfficeRef: d.office._id,
      }),
    ).toBe(1);
  });
  it("denies other offices, unassigned mutations, self-pickup, forwarding approval and OSAS supervisor operations", async () => {
    const d = await setup(role);
    const saved = await d.forward();
    expect(await canAccessComplaint(session(d.outsider), saved)).toBe(false);
    expect(await canAccessComplaint(session(d.osasStaff), saved)).toBe(false);
    d.login(d.staff);
    expect(await canAccessComplaint(session(d.staff), saved)).toBe(true);
    expect(await canProcessComplaint(session(d.staff), saved)).toBe(false);
    expect(
      (await assign(request({ assignedStaffRef: String(d.staff._id) }), context(saved._id))).status,
    ).toBe(403);
    expect(
      (
        await updateStatus(
          request(
            { status: "resolved", resolutionSummary: "Attempted unauthorized resolution." },
            "PATCH",
          ),
          context(saved._id),
        )
      ).status,
    ).toBe(403);
    expect((await roster(request({}, "GET"), context(d.office._id))).status).toBe(403);
    await expect(forwardingHistoryFilter(session(d.staff))).rejects.toThrow("Forbidden");
    await expect(
      changeForwarding(session(d.staff), {
        complaintId: String(saved._id),
        body: { destination: role, direct: true, reason: "Not authorized" },
      }),
    ).rejects.toThrow();
    const approved = (await ForwardingRequest.findOne({ complaintRef: saved._id }))!;
    await expect(
      changeForwarding(session(d.staff), {
        requestId: String(approved._id),
        body: { action: "approve" },
      }),
    ).rejects.toThrow();
    d.login(d.receivingHead);
    expect(
      (
        await assign(
          request({ assignedStaffRef: String(d.staff._id), message: "Assign to own staff." }),
          context(saved._id),
        )
      ).status,
    ).toBe(200);
    d.login(d.staff);
    expect(
      (
        await requestReview(
          request({ reason: "Attempt OSAS head review from another office." }),
          context(saved._id),
        )
      ).status,
    ).toBe(403);
    d.login(d.receivingHead);
    expect((await roster(request({}, "GET"), context(d.otherOffice._id))).status).toBe(403);
    expect(
      (
        await assign(
          request({
            assignedStaffRef: String(d.outsider._id),
            message: "Cannot transfer across offices.",
          }),
          context(saved._id),
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await assign(
          request({
            assignedOfficeRef: String(d.osas._id),
            assignedStaffRef: String(d.osasStaff._id),
            message: "Cannot change ownership.",
          }),
          context(saved._id),
        )
      ).status,
    ).toBe(400);
    await User.updateOne({ _id: d.staff._id }, { isActive: false });
    expect(
      (
        await assign(
          request({ assignedStaffRef: String(d.staff._id), message: "Inactive target." }),
          context(saved._id),
        )
      ).status,
    ).toBe(400);
  });
  it.each(["no-marker", "wrong-marker", "no-date", "inactive-office"])(
    "excludes %s records even if their office or assignee matches",
    async (invalid) => {
      const d = await setup(role);
      await Complaint.updateOne(
        { _id: d.complaint._id },
        {
          assignedOfficeRef: d.office._id,
          assignedStaffRef: d.staff._id,
          forwardedToRole:
            invalid === "no-marker"
              ? null
              : invalid === "wrong-marker"
                ? role === "vpaa"
                  ? "vpaf"
                  : "vpaa"
                : role,
          forwardedAt: invalid === "no-date" ? null : new Date(),
        },
      );
      if (invalid === "inactive-office")
        await Office.updateOne({ _id: d.office._id }, { isActive: false });
      const saved = (await Complaint.findById(d.complaint._id))!;
      expect(await canAccessComplaint(session(d.staff), saved)).toBe(false);
      expect(await canProcessComplaint(session(d.staff), saved)).toBe(false);
      expect(await Complaint.countDocuments(await staffComplaintFilter(session(d.staff)))).toBe(0);
      d.login(d.receivingHead);
      expect(
        (
          await assign(
            request({
              assignedStaffRef: String(d.staff._id),
              message: "Unforwarded data is inaccessible.",
            }),
            context(saved._id),
          )
        ).status,
      ).toBe(403);
    },
  );
});
