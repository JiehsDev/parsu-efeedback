/* eslint-disable @typescript-eslint/no-require-imports */
import { beforeAll, afterAll, beforeEach, describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
import mongoose from "mongoose";
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  ticket: 0,
  upload: vi.fn(async () => "reports/test.csv"),
}));
vi.mock("@/lib/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/db", () => ({ connectToDatabase: vi.fn() }));
vi.mock("@/lib/env", () => ({ env: { CRON_SECRET: "test-secret" } }));
vi.mock("@/lib/r2", () => ({ r2Client: null, isR2Configured: () => false }));
vi.mock("@/features/settings/services/settings.service", () => ({
  getSettings: async () => ({ slaHolidays: [] }),
  updateSettings: vi.fn(),
}));
vi.mock("@/features/audit-log/services/audit-log.service", () => ({ writeAuditLog: vi.fn() }));
vi.mock("@/features/notifications/services/notification.service", () => ({
  notifyComplaintAssigned: vi.fn(),
  notifyComplaintRoutedToOffice: vi.fn(),
  notifyComplaintSubmitted: vi.fn(),
  notifyStatusUpdated: vi.fn(),
  notifyComplaintResolved: vi.fn(),
  notifyInformationRequested: vi.fn(),
  notifyManualEscalation: vi.fn(),
  notifyAssignmentReleased: vi.fn(),
  notifyArchiveRequested: vi.fn(),
  notifySlaWarning: vi.fn(),
  notifyEscalation: vi.fn(),
}));
vi.mock("@/features/complaints/services/ticket-number.service", () => ({
  generateTicketNumber: async () => `CENTRAL-${++mocks.ticket}`,
}));
vi.mock("@/features/reports/services/report-upload.service", () => ({
  uploadReportFile: mocks.upload,
}));
import { connectTestDb, disconnectTestDb, clearTestDb } from "@/test/setup-db";
import {
  createTestOffice,
  createTestUser,
  createTestCategory,
  createTestSlaRule,
  createTestRoutingRule,
} from "@/test/fixtures";
import { Complaint, Office, User, Assignment, ComplaintTimeline, ArchiveRequest } from "@/models";
import { POST as submit, GET as list } from "@/app/api/complaints/route";
import { POST as assign } from "@/app/api/complaints/[id]/assign/route";
import { PATCH as status } from "@/app/api/complaints/[id]/route";
import { POST as information } from "@/app/api/complaints/[id]/information-request/route";
import { POST as note } from "@/app/api/complaints/[id]/notes/route";
import { POST as escalate } from "@/app/api/complaints/[id]/escalate/route";
import { POST as transfer } from "@/app/api/complaints/[id]/reassign-office/route";
import { POST as release } from "@/app/api/complaints/[id]/release/route";
import { PATCH as archive } from "@/app/api/complaints/[id]/archive/route";
import { POST as requestArchive } from "@/app/api/complaints/[id]/archive-request/route";
import { PATCH as approveArchive } from "@/app/api/archive-requests/[id]/route";
import { GET as analytics } from "@/app/api/analytics/trends/route";
import { POST as report } from "@/app/api/reports/export/route";
import { POST as slaCheck } from "@/app/api/cron/sla-check/route";
import { seedDevelopmentData } from "@/features/seed/seed.service";
const { centralizeOsas } = require("../../../scripts/centralize-osas.cjs");
beforeAll(connectTestDb);
afterAll(disconnectTestDb);
beforeEach(clearTestDb);
function request(body: any = {}, method = "POST") {
  return new NextRequest("http://localhost/api/test", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
function context(id: any) {
  return { params: Promise.resolve({ id: String(id) }) };
}
async function setup() {
  const osas = await createTestOffice({ code: "OSAS" });
  const legacy = await createTestOffice({ code: "ICTO" });
  const head = await createTestUser({ role: "osas", officeRef: osas._id });
  const staff = await createTestUser({ role: "office_staff", officeRef: osas._id });
  const other = await createTestUser({ role: "office_staff", officeRef: osas._id });
  const outsider = await createTestUser({ role: "office_staff", officeRef: legacy._id });
  const student = await createTestUser();
  await Office.updateOne({ _id: osas._id }, { $set: { headUserRef: head._id } });
  const category = await createTestCategory({ defaultOfficeRef: legacy._id });
  await createTestSlaRule(String(category._id), { escalateToOfficeRef: legacy._id });
  await createTestRoutingRule(String(category._id), String(legacy._id));
  const complaint = await Complaint.create({
    ticketNumber: "CENTRAL-TEST",
    studentRef: student._id,
    categoryRef: category._id,
    title: "Central test complaint",
    description: "All complaint handling stays in OSAS.",
    status: "submitted",
    priority: "medium",
    assignedOfficeRef: osas._id,
  });
  const login = (user: any, role = user.role) =>
    mocks.auth.mockResolvedValue({
      user: {
        id: String(user._id),
        role,
        officeRef: user.officeRef ? String(user.officeRef) : null,
      },
    });
  return { osas, legacy, head, staff, other, outsider, student, category, complaint, login };
}
describe("centralized OSAS architecture", () => {
  it.each([
    "ict",
    "health",
    "academic",
    "administrative",
    "finance",
    "facilities",
    "student_services",
    "other",
  ] as const)("routes %s complaints to OSAS despite old routing configuration", async (domain) => {
    const d = await setup();
    await User.updateOne({ _id: d.student._id }, { $set: { collegeRef: null } });
    d.category.domain = domain;
    await d.category.save();
    d.login(d.student);
    const response = await submit(
      request({
        categoryRef: String(d.category._id),
        title: "New concern submitted",
        description: "This new concern must be routed to OSAS exclusively.",
      }),
    );
    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.complaint.assignedOfficeRef).toBe(String(d.osas._id));
    expect(data.complaint.assignedStaffRef).toBeNull();
    expect(data.complaint.status).toBe("submitted");
  });
  it.each(["vpaa", "vpaf"])(
    "makes %s oversight read-only at every processing API",
    async (role) => {
      const d = await setup();
      d.login(d.student, role);
      const ctx = context(d.complaint._id);
      for (const [handler, body, method] of [
        [assign, { action: "assign", assignedStaffRef: String(d.staff._id) }, "POST"],
        [status, { status: "in_progress" }, "PATCH"],
        [status, { status: "resolved" }, "PATCH"],
        [information, { requestMessage: "Please explain" }, "POST"],
        [note, { body: "Processing note" }, "POST"],
        [escalate, { reason: "Supervisor review" }, "POST"],
        [
          transfer,
          {
            destinationOfficeRef: String(d.legacy._id),
            reasonCode: "other",
            reasonText: "Transfer",
          },
          "POST",
        ],
        [release, { reason: "Release" }, "POST"],
        [archive, { isArchived: true, reason: "Archive" }, "PATCH"],
        [requestArchive, { reasonCode: "other", reasonText: "Archive" }, "POST"],
      ] as const) {
        expect((await handler(request(body, method), ctx)).status).toBe(403);
      }
      const archiveRequest = await ArchiveRequest.create({
        complaintRef: d.complaint._id,
        officeRef: d.osas._id,
        requestedByRef: d.staff._id,
        reason: "Review",
        reasonText: "Review",
      });
      expect(
        (await approveArchive(request({ action: "approve" }, "PATCH"), context(archiveRequest._id)))
          .status,
      ).toBe(403);
      expect((await analytics()).status).toBe(200);
      expect((await report(request({ format: "csv", filters: {} }))).status).toBe(200);
      expect((await list(new NextRequest("http://localhost/api/complaints"))).status).toBe(200);
      expect((await Complaint.findById(d.complaint._id))!.status).toBe("submitted");
    },
  );
  it("lets the OSAS Head assign staff and change assignee with a reason, exclusively inside OSAS", async () => {
    const d = await setup();
    d.login(d.head);
    const ctx = context(d.complaint._id);
    expect(
      (await assign(request({ action: "assign", assignedStaffRef: String(d.outsider._id) }), ctx))
        .status,
    ).toBe(400);
    expect(
      (await assign(request({ action: "assign", assignedStaffRef: String(d.staff._id) }), ctx))
        .status,
    ).toBe(200);
    expect((await Complaint.findById(d.complaint._id))!.status).toBe("in_progress");
    expect(
      (await assign(request({ action: "assign", assignedStaffRef: String(d.other._id) }), ctx))
        .status,
    ).toBe(400);
    expect(
      (
        await assign(
          request({
            action: "reassign",
            assignedStaffRef: String(d.other._id),
            message: "Balance OSAS workload",
          }),
          ctx,
        )
      ).status,
    ).toBe(200);
    expect(String((await Complaint.findById(d.complaint._id))!.assignedStaffRef)).toBe(
      String(d.other._id),
    );
  });
  it("supports Handle Personally using Office.headUserRef", async () => {
    const d = await setup();
    d.login(d.head);
    expect(
      (
        await assign(
          request({ action: "assign", assignedStaffRef: String(d.head._id) }),
          context(d.complaint._id),
        )
      ).status,
    ).toBe(200);
    const saved = (await Complaint.findById(d.complaint._id))!;
    expect(saved.status).toBe("in_progress");
    expect(String(saved.assignedStaffRef)).toBe(String(d.head._id));
  });
  it("prevents ordinary staff pickup and restricts processing and viewing to their assignments", async () => {
    const d = await setup();
    d.login(d.staff);
    const ctx = context(d.complaint._id);
    expect((await assign(request({ assignedStaffRef: String(d.staff._id) }), ctx)).status).toBe(
      403,
    );
    await expect(
      (await list(new NextRequest("http://localhost/api/complaints"))).json(),
    ).resolves.toMatchObject({ total: 0 });
    d.complaint.assignedStaffRef = d.staff._id;
    d.complaint.status = "in_progress";
    await d.complaint.save();
    expect((await status(request({ status: "resolved" }, "PATCH"), ctx)).status).toBe(200);
  });
  it("returns released assignments to the OSAS unassigned queue", async () => {
    const d = await setup();
    d.complaint.assignedStaffRef = d.staff._id;
    d.complaint.status = "in_progress";
    await d.complaint.save();
    d.login(d.staff);
    expect(
      (
        await release(
          request({ reason: "Unable to resolve; needs another handler" }),
          context(d.complaint._id),
        )
      ).status,
    ).toBe(200);
    const saved = (await Complaint.findById(d.complaint._id))!;
    expect(saved.status).toBe("submitted");
    expect(saved.assignedStaffRef).toBeNull();
    expect(String(saved.assignedOfficeRef)).toBe(String(d.osas._id));
  });
  it("escalates internally to OSAS Head without creating a legacy escalated status", async () => {
    const d = await setup();
    d.complaint.assignedStaffRef = d.staff._id;
    d.complaint.status = "in_progress";
    await d.complaint.save();
    d.login(d.staff);
    expect(
      (await escalate(request({ reason: "Needs supervisor review" }), context(d.complaint._id)))
        .status,
    ).toBe(200);
    const saved = (await Complaint.findById(d.complaint._id))!;
    expect(String(saved.assignedOfficeRef)).toBe(String(d.osas._id));
    expect(String(saved.assignedStaffRef)).toBe(String(d.head._id));
    expect(saved.status).toBe("in_progress");
    expect(saved.supervisorReviewRequired).toBe(true);
  });
  it("ignores legacy cross-office escalation configuration on SLA breach", async () => {
    const d = await setup();
    d.complaint.slaResolutionDueAt = new Date(Date.now() - 3600000);
    d.complaint.assignedStaffRef = d.staff._id;
    d.complaint.status = "in_progress";
    await d.complaint.save();
    const response = await slaCheck(
      new NextRequest("http://localhost/api/cron/sla-check", {
        method: "POST",
        headers: { "x-cron-secret": "test-secret" },
      }),
    );
    expect(response.status).toBe(200);
    const saved = (await Complaint.findById(d.complaint._id))!;
    expect(String(saved.assignedOfficeRef)).toBe(String(d.osas._id));
    expect(saved.supervisorReviewRequired).toBe(true);
    expect(saved.status).toBe("in_progress");
  });
  it("disables office reassignment for every user", async () => {
    const d = await setup();
    for (const role of ["osas", "office_staff", "vpaa", "vpaf", "administrator"]) {
      d.login(d.head, role);
      expect((await transfer()).status).toBe(403);
    }
  });
  it("migrates only active non-archived records, preserves history, and is idempotent", async () => {
    const d = await setup();
    d.complaint.assignedOfficeRef = d.legacy._id;
    d.complaint.assignedStaffRef = d.outsider._id;
    d.complaint.status = "assigned";
    await d.complaint.save();
    const historical = await Complaint.create({
      ticketNumber: "CLOSED-OLD",
      studentRef: d.student._id,
      categoryRef: d.category._id,
      title: "Historical",
      description: "Historical record retained.",
      status: "closed",
      priority: "medium",
      assignedOfficeRef: d.legacy._id,
    });
    await ComplaintTimeline.create({
      complaintRef: d.complaint._id,
      eventType: "submitted",
      message: "Original event",
    });
    const db = mongoose.connection.db!;
    const preview = await centralizeOsas(db);
    expect(preview.activeComplaintsToMigrate).toBe(1);
    expect((await centralizeOsas(db, { apply: true })).updated).toBe(1);
    expect((await centralizeOsas(db, { apply: true })).updated).toBe(0);
    const saved = (await Complaint.findById(d.complaint._id))!;
    expect(String(saved.assignedOfficeRef)).toBe(String(d.osas._id));
    expect(saved.assignedStaffRef).toBeNull();
    expect(String((await Complaint.findById(historical._id))!.assignedOfficeRef)).toBe(
      String(d.legacy._id),
    );
    expect(await ComplaintTimeline.countDocuments({ complaintRef: d.complaint._id })).toBe(2);
    expect(await Assignment.countDocuments({ complaintRef: d.complaint._id })).toBe(1);
  });
  it("seeds stable accounts/categories and zero complaints or dependent demo records", async () => {
    await setup();
    const first = await seedDevelopmentData();
    const head = await User.findOne({ email: "osasdirector@parsu.edu.ph" });
    const second = await seedDevelopmentData();
    expect(second.counts).toEqual(first.counts);
    expect(second.counts.complaints).toBe(0);
    expect(String((await User.findOne({ email: "osasdirector@parsu.edu.ph" }))!._id)).toBe(
      String(head!._id),
    );
    expect(await ComplaintTimeline.countDocuments()).toBe(0);
    expect(await Assignment.countDocuments()).toBe(0);
    expect(await ArchiveRequest.countDocuments()).toBe(0);
    const osas = await Office.findOne({ code: "OSAS" });
    expect(
      await mongoose.connection
        .db!.collection("routing_rules")
        .countDocuments({ isActive: true, targetOfficeRef: { $ne: osas!._id } }),
    ).toBe(0);
  });
});
