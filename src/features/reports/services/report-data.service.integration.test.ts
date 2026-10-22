// src/features/reports/services/report-data.service.integration.test.ts
// BR-080/081 — queryReportData runs a real aggregation pipeline, so this
// needs a real (in-memory) MongoDB rather than mocks.
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { connectTestDb, disconnectTestDb, clearTestDb } from "@/test/setup-db";
import { Complaint } from "@/models/Complaint";
import { Category } from "@/models/Category";
import { createTestUser, createTestOffice, createTestCategory } from "@/test/fixtures";
import { queryReportData } from "./report-data.service";

beforeAll(connectTestDb);
afterAll(disconnectTestDb);
beforeEach(clearTestDb);

async function seedTwoOfficesTwoStatuses() {
  const officeA = await createTestOffice({ name: "Office A" });
  const officeB = await createTestOffice({ name: "Office B" });
  const category = await createTestCategory({ defaultOfficeRef: officeA._id });
  const student = await createTestUser({ role: "student" });

  const submitted = await Complaint.create({
    ticketNumber: "TEST-A-1",
    studentRef: student._id,
    categoryRef: category._id,
    title: "Complaint at office A, submitted",
    description: "Test description long enough to pass validation",
    priority: "medium",
    status: "submitted",
    assignedOfficeRef: officeA._id,
  });

  const resolvedOnTime = await Complaint.create({
    ticketNumber: "TEST-B-1",
    studentRef: student._id,
    categoryRef: category._id,
    title: "Complaint at office B, resolved on time",
    description: "Test description long enough to pass validation",
    priority: "high",
    status: "resolved",
    assignedOfficeRef: officeB._id,
    slaResolutionDueAt: new Date("2026-01-10T00:00:00Z"),
    resolvedAt: new Date("2026-01-05T00:00:00Z"),
  });

  const resolvedLate = await Complaint.create({
    ticketNumber: "TEST-B-2",
    studentRef: student._id,
    categoryRef: category._id,
    title: "Complaint at office B, resolved late",
    description: "Test description long enough to pass validation",
    priority: "high",
    status: "resolved",
    assignedOfficeRef: officeB._id,
    slaResolutionDueAt: new Date("2026-01-10T00:00:00Z"),
    resolvedAt: new Date("2026-01-15T00:00:00Z"),
  });

  return { officeA, officeB, submitted, resolvedOnTime, resolvedLate };
}

describe("queryReportData — BR-080/081", () => {
  it("filters explicit category domains, priority and SLA state", async () => {
    const { submitted } = await seedTwoOfficesTwoStatuses();
    await Category.updateOne({ _id: submitted.categoryRef }, { $set: { domain: "ict" } });
    submitted.slaResponseDueAt = new Date(Date.now() + 3600000);
    await submitted.save();
    expect(await queryReportData({ domain: "health" })).toHaveLength(0);
    const rows = await queryReportData({ domain: "ict", priority: "medium", slaState: "due_soon" });
    expect(rows.map((row) => row.ticketNumber)).toEqual([submitted.ticketNumber]);
    expect(rows[0]!.domain).toBe("ict");
    expect(await queryReportData({ domain: "ict", priority: "critical" })).toHaveLength(0);
  });

  it("includes resolution details, legacy fallback and previous-resolution labels", async () => {
    const { resolvedOnTime, submitted } = await seedTwoOfficesTwoStatuses();
    resolvedOnTime.resolutionSummary = "Replaced projector lamp.\nVerified operation.";
    await resolvedOnTime.save();
    submitted.status = "in_progress";
    submitted.resolutionSummary = "Previous repair.";
    await submitted.save();
    const rows = await queryReportData({});
    expect(rows.find((row) => row.ticketNumber === "TEST-B-1")?.resolutionSummary).toBe(
      resolvedOnTime.resolutionSummary,
    );
    expect(rows.find((row) => row.ticketNumber === "TEST-B-2")?.resolutionSummary).toBe(
      "No resolution details recorded.",
    );
    expect(rows.find((row) => row.ticketNumber === "TEST-A-1")?.resolutionSummary).toBe(
      "Previous resolution: Previous repair.",
    );
  });

  it("BR-080: with no filters, returns rows for every non-archived complaint", async () => {
    await seedTwoOfficesTwoStatuses();
    const rows = await queryReportData({});
    expect(rows).toHaveLength(3);
  });

  it("BR-080: filters by officeRef", async () => {
    const { officeB } = await seedTwoOfficesTwoStatuses();
    const rows = await queryReportData({ officeRef: String(officeB._id) });
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.ticketNumber.startsWith("TEST-B"))).toBe(true);
  });

  it("BR-080: filters by status", async () => {
    await seedTwoOfficesTwoStatuses();
    const rows = await queryReportData({ status: "resolved" });
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.status === "resolved")).toBe(true);
  });

  it("BR-081: slaOnly keeps only SLA-non-compliant rows", async () => {
    await seedTwoOfficesTwoStatuses();
    const rows = await queryReportData({ slaOnly: true });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.ticketNumber).toBe("TEST-B-2");
    expect(rows[0]!.slaCompliant).toBe("No");
  });

  it("BR-081: a resolved-on-time complaint is marked SLA-compliant", async () => {
    await seedTwoOfficesTwoStatuses();
    const rows = await queryReportData({});
    const onTime = rows.find((r) => r.ticketNumber === "TEST-B-1");
    expect(onTime!.slaCompliant).toBe("Yes");
  });

  it("BR-081: a not-yet-resolved complaint's SLA compliance is N/A", async () => {
    await seedTwoOfficesTwoStatuses();
    const rows = await queryReportData({});
    const submitted = rows.find((r) => r.ticketNumber === "TEST-A-1");
    expect(submitted!.slaCompliant).toBe("N/A");
  });

  it("BR-080: filters by date range", async () => {
    await seedTwoOfficesTwoStatuses();
    const farFuture = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
    const rows = await queryReportData({ dateFrom: farFuture });
    expect(rows).toHaveLength(0);
  });
});
