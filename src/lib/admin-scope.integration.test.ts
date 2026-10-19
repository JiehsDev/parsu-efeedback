import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { Types } from "mongoose";

const mocks = vi.hoisted(() => ({ auth: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/db", () => ({ connectToDatabase: vi.fn() }));
vi.mock("@/lib/r2", () => ({ r2Client: null, isR2Configured: () => false }));
vi.mock("@/features/notifications/services/notification.service", () => ({
  notifyComplaintRoutedToOffice: vi.fn(),
  notifyComplaintSubmitted: vi.fn(),
  notifyStatusUpdated: vi.fn(),
  notifyComplaintResolved: vi.fn(),
}));
vi.mock("@/features/audit-log/services/audit-log.service", () => ({ writeAuditLog: vi.fn() }));
import { connectTestDb, disconnectTestDb, clearTestDb } from "@/test/setup-db";
import {
  createTestOffice,
  createTestCollege,
  createTestCategory,
  createTestUser,
  createTestRoutingRule,
  createTestSlaRule,
} from "@/test/fixtures";
import { Complaint } from "@/models/Complaint";
import { Office } from "@/models/Office";
import { complaintFilterForScope, getAdminScope, isComplaintInAdminScope } from "./admin-scope";
import { canAccessComplaint } from "./complaint-access";
import { queryReportData } from "@/features/reports/services/report-data.service";
import { getAnalyticsSummary } from "@/features/analytics/services/analytics.service";
import { GET as listComplaints } from "@/app/api/complaints/route";
import { GET as getComplaint } from "@/app/api/complaints/[id]/route";
import { GET as getAttachments } from "@/app/api/complaints/[id]/attachments/route";
import { GET as getNotes } from "@/app/api/complaints/[id]/notes/route";
import { GET as downloadReport } from "@/app/api/reports/[id]/download/route";
import { GET as printReport } from "@/app/api/reports/[id]/print/route";
import { GET as getNotifications } from "@/app/api/notifications/route";
import { PATCH as readNotification } from "@/app/api/notifications/[id]/read/route";
import { GeneratedReport } from "@/models/GeneratedReport";
import { Notification } from "@/models/Notification";

beforeAll(connectTestDb);
afterAll(disconnectTestDb);
beforeEach(clearTestDb);

async function seed() {
  const osas = await createTestOffice({ code: "OSAS", name: "Student Affairs" });
  const university = await createTestOffice({ name: "Registrar" });
  const college = await createTestCollege();
  const student = await createTestUser({ collegeRef: college._id });
  const privateCategory = await createTestCategory({ defaultOfficeRef: osas._id });
  const publicCategory = await createTestCategory({ defaultOfficeRef: university._id });
  async function complaint(ticket: string, office: Types.ObjectId, category = privateCategory._id) {
    return Complaint.create({
      ticketNumber: ticket,
      studentRef: student._id,
      categoryRef: category,
      title: `Complaint ${ticket}`,
      description: "A sufficiently detailed test complaint.",
      status: "submitted",
      priority: "medium",
      assignedOfficeRef: office,
    });
  }
  const privateComplaints = [
    await complaint("OSAS-OWN", osas._id),
    await complaint("OSAS-TRANSFER-UNIVERSITY", university._id),
    await complaint("OSAS-TRANSFER-COLLEGE", college._id),
  ];
  const ordinaryUniversity = await complaint(
    "ORDINARY-UNIVERSITY",
    university._id,
    publicCategory._id,
  );
  const ordinaryCollege = await complaint("ORDINARY-COLLEGE", college._id, publicCategory._id);
  return {
    osas,
    university,
    college,
    student,
    privateComplaints,
    ordinaryUniversity,
    ordinaryCollege,
  };
}

describe("OSAS complaint privacy", () => {
  it("keeps list queries, direct access, reports and analytics within each role's scope", async () => {
    const data = await seed();
    for (const [role, expected] of [
      ["osas", data.privateComplaints],
      ["vpaf", [data.ordinaryUniversity]],
      ["vpaa", [data.ordinaryCollege]],
    ] as const) {
      const filter = await complaintFilterForScope(getAdminScope(role));
      const expectedTickets = expected.map((row) => row.ticketNumber).sort();
      expect((await Complaint.find(filter).lean()).map((row) => row.ticketNumber).sort()).toEqual(
        expectedTickets,
      );
      expect((await queryReportData({}, filter)).map((row) => row.ticketNumber).sort()).toEqual(
        expectedTickets,
      );
      expect((await getAnalyticsSummary(filter)).totalComplaints).toBe(expected.length);
      for (const complaint of data.privateComplaints) {
        expect(await isComplaintInAdminScope(getAdminScope(role), complaint)).toBe(role === "osas");
      }
    }
    expect(
      await isComplaintInAdminScope(getAdminScope("administrator"), data.privateComplaints[0]!),
    ).toBe(true);
    expect(
      await canAccessComplaint(
        { user: { role: "student", id: String(data.student._id) } },
        data.privateComplaints[0],
      ),
    ).toBe(true);
  });

  it.each(["vpaa", "vpaf", "osas"] as const)(
    "enforces %s API list and direct-resource permissions",
    async (role) => {
      const data = await seed();
      mocks.auth.mockResolvedValue({ user: { id: new Types.ObjectId().toString(), role } });
      const list = await listComplaints(new NextRequest("http://localhost/api/complaints"));
      const body = await list.json();
      expect(body.total).toBe(role === "osas" ? 3 : 1);
      const target = role === "osas" ? data.ordinaryUniversity : data.privateComplaints[0]!;
      const request = new NextRequest("http://localhost/api/complaints/test");
      const context = { params: Promise.resolve({ id: String(target._id) }) };
      expect((await getComplaint(request, context)).status).toBe(403);
      expect((await getAttachments(request, context)).status).toBe(403);
      expect((await getNotes(request, context)).status).toBe(403);
    },
  );

  it("does not allow search or archived-office filters to overwrite the privacy constraint", async () => {
    const data = await seed();
    const filter = await complaintFilterForScope(getAdminScope("vpaf"));
    expect(
      await Complaint.countDocuments({
        ...filter,
        assignedOfficeRef: data.osas._id,
        $or: [{ title: /Complaint/ }],
      }),
    ).toBe(0);
  });

  it("protects complaints linked through routing or escalation and inactive OSAS offices", async () => {
    const data = await seed();
    const routedCategory = await createTestCategory({ defaultOfficeRef: data.university._id });
    await createTestRoutingRule(String(routedCategory._id), String(data.osas._id));
    await Complaint.updateOne(
      { _id: data.ordinaryUniversity._id },
      { $set: { categoryRef: routedCategory._id } },
    );
    await createTestSlaRule(String(data.ordinaryCollege.categoryRef), {
      escalateToOfficeRef: data.osas._id,
    });
    await Office.updateOne({ _id: data.osas._id }, { $set: { isActive: false } });
    expect(
      await Complaint.countDocuments(await complaintFilterForScope(getAdminScope("vpaf"))),
    ).toBe(0);
    expect(
      await Complaint.countDocuments(await complaintFilterForScope(getAdminScope("vpaa"))),
    ).toBe(0);
    expect(
      await Complaint.countDocuments(await complaintFilterForScope(getAdminScope("osas"))),
    ).toBe(5);
  });

  it("gives OSAS no complaints when its office is missing", async () => {
    await seed();
    await Office.updateOne({ code: "OSAS" }, { $set: { code: "RENAMED" } });
    expect(
      await Complaint.countDocuments(await complaintFilterForScope(getAdminScope("osas"))),
    ).toBe(0);
  });

  it.each(["vpaa", "vpaf", "osas"] as const)(
    "rechecks %s permissions on old report downloads and print views",
    async (role) => {
      await seed();
      const user = await createTestUser({ role });
      mocks.auth.mockResolvedValue({ user: { id: String(user._id), role } });
      const report = await GeneratedReport.create({
        creatorRef: user._id,
        reportType: "complaint-export",
        format: "csv",
        filters: {},
        status: "ready",
        downloadUrl: "old-unrestricted-report.csv",
      });
      const context = { params: Promise.resolve({ id: String(report._id) }) };
      for (const handler of [downloadReport, printReport]) {
        const response = await handler(
          new NextRequest("http://localhost/api/reports/test"),
          context,
        );
        expect(response.status).toBe(200);
        const body = await response.text();
        expect(body.includes("OSAS-OWN")).toBe(role === "osas");
        expect(body.includes("ORDINARY-UNIVERSITY")).toBe(role === "vpaf");
        expect(body.includes("ORDINARY-COLLEGE")).toBe(role === "vpaa");
      }
    },
  );

  it("hides existing private notifications and their unread count from other sub-admins", async () => {
    const data = await seed();
    const user = await createTestUser({ role: "vpaf" });
    mocks.auth.mockResolvedValue({ user: { id: String(user._id), role: "vpaf" } });
    const hidden = await Notification.create({
      userRef: user._id,
      type: "status_updated",
      title: "Private OSAS update",
      body: "Sensitive details",
      relatedComplaintRef: data.privateComplaints[0]!._id,
    });
    await Notification.create({
      userRef: user._id,
      type: "status_updated",
      title: "Visible update",
      body: "Ordinary update",
      relatedComplaintRef: data.ordinaryUniversity._id,
    });
    const response = await getNotifications(new NextRequest("http://localhost/api/notifications"));
    const body = await response.json();
    expect(body.notifications).toHaveLength(1);
    expect(body.unreadCount).toBe(1);
    expect(
      (
        await readNotification(new NextRequest("http://localhost/api/notifications/test/read"), {
          params: Promise.resolve({ id: String(hidden._id) }),
        })
      ).status,
    ).toBe(403);
  });
});
