import { beforeAll, afterAll, beforeEach, describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
const auth = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth", () => ({ auth }));
vi.mock("@/lib/db", () => ({ connectToDatabase: vi.fn() }));
vi.mock("@/lib/r2", () => ({ r2Client: null, isR2Configured: () => false }));
import { connectTestDb, disconnectTestDb, clearTestDb } from "@/test/setup-db";
import { createTestOffice, createTestCategory, createTestUser } from "@/test/fixtures";
import { Complaint, Office, GeneratedReport } from "@/models";
import { complaintFilterForScope, getAdminScope, isComplaintInAdminScope } from "./admin-scope";
import { canAccessComplaint, canWriteInternalComplaintNotes } from "./complaint-access";
import { GET as download } from "@/app/api/reports/[id]/download/route";
import { GET as print } from "@/app/api/reports/[id]/print/route";
import { queryReportData } from "@/features/reports/services/report-data.service";
beforeAll(connectTestDb);
afterAll(disconnectTestDb);
beforeEach(clearTestDb);
async function setup() {
  const office = await createTestOffice({ code: "OSAS" });
  const legacy = await createTestOffice({ code: "ICTO" });
  const student = await createTestUser();
  const category = await createTestCategory({ defaultOfficeRef: office._id });
  const head = await createTestUser({ role: "osas", officeRef: office._id });
  await Office.updateOne({ _id: office._id }, { $set: { headUserRef: head._id } });
  const c = await Complaint.create({
    ticketNumber: "OSAS-RECORD",
    studentRef: student._id,
    categoryRef: category._id,
    title: "OSAS complaint",
    description: "Complaint handled centrally by OSAS.",
    priority: "medium",
    assignedOfficeRef: office._id,
  });
  const old = await Complaint.create({
    ticketNumber: "HISTORICAL-RECORD",
    studentRef: student._id,
    categoryRef: category._id,
    title: "Historical complaint",
    description: "Historical record retained.",
    priority: "medium",
    status: "closed",
    assignedOfficeRef: legacy._id,
  });
  return { office, student, head, c, old };
}
describe("oversight and operational read scope", () => {
  it.each(["vpaa", "vpaf"] as const)(
    "allows %s global read-only oversight while domain scoping is unavailable",
    async (role) => {
      const d = await setup();
      const scope = getAdminScope(role);
      expect(await Complaint.countDocuments(await complaintFilterForScope(scope))).toBe(2);
      expect(await isComplaintInAdminScope(scope, d.c)).toBe(true);
      expect(await isComplaintInAdminScope(scope, d.old)).toBe(true);
      const session = { user: { id: String(d.student._id), role } };
      expect(await canAccessComplaint(session, d.c)).toBe(true);
      expect(await canWriteInternalComplaintNotes(session, d.c)).toBe(false);
      expect((await queryReportData({}, await complaintFilterForScope(scope))).length).toBe(2);
    },
  );
  it("keeps OSAS handling limited to the OSAS queue", async () => {
    const d = await setup();
    expect(
      await Complaint.countDocuments(await complaintFilterForScope(getAdminScope("osas"))),
    ).toBe(1);
    expect(
      await canAccessComplaint(
        { user: { id: String(d.head._id), role: "osas", officeRef: String(d.office._id) } },
        d.old,
      ),
    ).toBe(false);
  });
  it.each(["vpaa", "vpaf"] as const)(
    "keeps %s stored report downloads and print views available with current read scope",
    async (role) => {
      const d = await setup();
      auth.mockResolvedValue({ user: { id: String(d.student._id), role } });
      const report = await GeneratedReport.create({
        creatorRef: d.student._id,
        reportType: "complaint-export",
        format: "csv",
        status: "ready",
        downloadUrl: "old-report.csv",
        filters: {},
      });
      for (const handler of [download, print]) {
        const response = await handler(new NextRequest("http://localhost/api/reports/test"), {
          params: Promise.resolve({ id: String(report._id) }),
        });
        expect(response.status).toBe(200);
        const body = await response.text();
        expect(body).toContain("OSAS-RECORD");
        expect(body).toContain("HISTORICAL-RECORD");
      }
    },
  );
  it("fails closed for an OSAS queue when the office is unavailable", async () => {
    const d = await setup();
    await Office.updateOne({ _id: d.office._id }, { $set: { isActive: false } });
    expect(
      await Complaint.countDocuments(await complaintFilterForScope(getAdminScope("osas"))),
    ).toBe(0);
  });
});
