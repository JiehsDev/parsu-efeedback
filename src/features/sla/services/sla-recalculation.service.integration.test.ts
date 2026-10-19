import { beforeAll, afterAll, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/features/settings/services/settings.service", () => ({ getSettings: vi.fn() }));
import { getSettings } from "@/features/settings/services/settings.service";
import { connectTestDb, disconnectTestDb, clearTestDb } from "@/test/setup-db";
import { createActivatableCategory, createTestUser } from "@/test/fixtures";
import { Complaint } from "@/models/Complaint";
import { ComplaintTimeline } from "@/models/ComplaintTimeline";
import { Assignment } from "@/models/Assignment";
import { getAnalyticsSummary } from "@/features/analytics/services/analytics.service";
import { queryReportData } from "@/features/reports/services/report-data.service";
import { planSlaRecalculation, applySlaRecalculation } from "./sla-recalculation.service";
import { computeSlaDates } from "./sla.service";

beforeAll(connectTestDb);
afterAll(disconnectTestDb);
beforeEach(async () => {
  await clearTestDb();
  vi.mocked(getSettings).mockResolvedValue({ slaHolidays: ["2026-10-26"] } as Awaited<
    ReturnType<typeof getSettings>
  >);
});

async function setup() {
  const { category, office } = await createActivatableCategory();
  const student = await createTestUser({ role: "student" });
  const staff = await createTestUser({ role: "office_staff", officeRef: office._id });
  const start = new Date("2026-10-23T18:00:00+08:00");
  const complaint = await Complaint.create({
    ticketNumber: "TEST-CALENDAR",
    studentRef: student._id,
    categoryRef: category._id,
    title: "Calendar test",
    description: "Testing weekday SLA response and resolution.",
    priority: "medium",
    status: "in_progress",
    assignedOfficeRef: office._id,
    assignedStaffRef: staff._id,
    submittedAt: start,
    slaResponseDueAt: new Date(start.getTime() + 24 * 3_600_000),
    slaResolutionDueAt: new Date(start.getTime() + 72 * 3_600_000),
  });
  return { complaint, staff, start, category, student, office };
}

describe("SLA calendar recalculation and reporting", () => {
  it("previews without mutation, saves policy snapshots, and is idempotent", async () => {
    const { complaint, staff } = await setup();
    const plan = await planSlaRecalculation();
    expect(plan.rows).toHaveLength(1);
    expect((await Complaint.findById(complaint._id).lean())!.slaPolicy).toBeNull();
    expect(await applySlaRecalculation(plan, String(staff._id))).toEqual({
      updated: 1,
      skipped: 0,
    });
    const saved = (await Complaint.findById(complaint._id).lean())!;
    expect(saved.slaPolicy?.holidays).toEqual(["2026-10-26"]);
    expect(saved.slaResponseDueAt).toEqual(new Date("2026-10-27T18:00:00+08:00"));
    expect(saved.slaResolutionDueAt).toEqual(new Date("2026-10-29T18:00:00+08:00"));
    expect(await ComplaintTimeline.countDocuments({ complaintRef: complaint._id })).toBe(1);
    expect((await planSlaRecalculation()).rows).toHaveLength(0);
    expect(await applySlaRecalculation(plan, String(staff._id))).toEqual({ updated: 0, skipped: 1 });
  });

  it("excludes resolved, closed, withdrawn and archived complaints", async () => {
    const { complaint } = await setup();
    for (const status of ["resolved", "closed", "withdrawn"] as const) {
      await Complaint.updateOne({ _id: complaint._id }, { status });
      expect((await planSlaRecalculation()).rows).toHaveLength(0);
    }
    await Complaint.updateOne({ _id: complaint._id }, { status: "in_progress", isArchived: true });
    expect((await planSlaRecalculation()).rows).toHaveLength(0);
  });

  it("skips complaints resolved between preview and apply", async () => {
    const { complaint, staff } = await setup();
    const plan = await planSlaRecalculation();
    await Complaint.updateOne({ _id: complaint._id }, { status: "resolved" });
    expect(await applySlaRecalculation(plan, String(staff._id))).toEqual({
      updated: 0,
      skipped: 1,
    });
    expect((await Complaint.findById(complaint._id).lean())!.slaPolicy).toBeNull();
  });

  it("changes the preview token when the holiday calendar changes", async () => {
    await setup();
    const first = await planSlaRecalculation();
    vi.mocked(getSettings).mockResolvedValue({ slaHolidays: [] as string[] } as Awaited<
      ReturnType<typeof getSettings>
    >);
    expect((await planSlaRecalculation()).token).not.toBe(first.token);
  });

  it("counts eligible response/resolution hours in analytics and identifies the calendar in reports", async () => {
    const { complaint, staff, start, office } = await setup();
    const dates = computeSlaDates(start, { responseHours: 24, resolutionHours: 72 }, [
      "2026-10-26",
    ]);
    await Complaint.updateOne(
      { _id: complaint._id },
      { ...dates, status: "resolved", resolvedAt: new Date("2026-10-27T04:00:00+08:00") },
    );
    await Assignment.create({
      complaintRef: complaint._id,
      assignedByRef: staff._id,
      assignedToRef: staff._id,
      destinationOfficeRef: office._id,
      createdAt: new Date("2026-10-27T02:00:00+08:00"),
    });
    const summary = await getAnalyticsSummary({});
    expect(summary.averageFirstResponseHours).toBe(8);
    expect(summary.averageResolutionHours).toBe(10);
    expect((await queryReportData({}))[0]!.slaCalendar).toContain("24h weekdays");
  });
});
