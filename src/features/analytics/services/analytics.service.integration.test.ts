// src/features/analytics/services/analytics.service.integration.test.ts
// BR-088/089/090 — seed a small deterministic set of complaints, call each
// aggregation function, and hand-compute the expected result.
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { connectTestDb, disconnectTestDb, clearTestDb } from "@/test/setup-db";
import { Complaint } from "@/models/Complaint";
import { createTestUser, createTestOffice, createTestCategory } from "@/test/fixtures";
import {
  getCategoryBreakdown,
  getPriorityBreakdown,
  getOfficeBreakdown,
  getSlaComplianceByOffice,
} from "./analytics.service";

beforeAll(connectTestDb);
afterAll(disconnectTestDb);
beforeEach(clearTestDb);

async function seedDeterministicComplaints() {
  const officeA = await createTestOffice({ name: "Office A" });
  const officeB = await createTestOffice({ name: "Office B" });
  const categoryX = await createTestCategory({ name: "Category X", defaultOfficeRef: officeA._id });
  const categoryY = await createTestCategory({ name: "Category Y", defaultOfficeRef: officeB._id });
  const student = await createTestUser({ role: "student" });

  // 2 complaints in category X / office A / priority high
  await Complaint.create({
    ticketNumber: "T-1",
    studentRef: student._id,
    categoryRef: categoryX._id,
    title: "One",
    description: "Test description long enough to pass validation",
    priority: "high",
    status: "submitted",
    assignedOfficeRef: officeA._id,
  });
  await Complaint.create({
    ticketNumber: "T-2",
    studentRef: student._id,
    categoryRef: categoryX._id,
    title: "Two",
    description: "Test description long enough to pass validation",
    priority: "high",
    status: "resolved",
    assignedOfficeRef: officeA._id,
    slaResolutionDueAt: new Date("2026-01-10T00:00:00Z"),
    resolvedAt: new Date("2026-01-05T00:00:00Z"), // compliant
  });
  // 1 complaint in category Y / office B / priority low, resolved late
  await Complaint.create({
    ticketNumber: "T-3",
    studentRef: student._id,
    categoryRef: categoryY._id,
    title: "Three",
    description: "Test description long enough to pass validation",
    priority: "low",
    status: "resolved",
    assignedOfficeRef: officeB._id,
    slaResolutionDueAt: new Date("2026-01-10T00:00:00Z"),
    resolvedAt: new Date("2026-01-15T00:00:00Z"), // non-compliant
  });

  return { officeA, officeB, categoryX, categoryY, student };
}

describe("analytics.service — BR-088/089", () => {
  it("getCategoryBreakdown groups volume by category name", async () => {
    await seedDeterministicComplaints();
    const result = await getCategoryBreakdown({});
    const byName = Object.fromEntries(result.map((r) => [r.category, r.volume]));
    expect(byName["Category X"]).toBe(2);
    expect(byName["Category Y"]).toBe(1);
  });

  it("getPriorityBreakdown groups volume by priority, ordered low→critical", async () => {
    await seedDeterministicComplaints();
    const result = await getPriorityBreakdown({});
    const byPriority = Object.fromEntries(result.map((r) => [r.priority, r.volume]));
    expect(byPriority.high).toBe(2);
    expect(byPriority.low).toBe(1);

    const order = result.map((r) => r.priority);
    const expectedOrder = ["low", "medium", "high", "critical"].filter((p) =>
      order.includes(p),
    );
    expect(order).toEqual(expectedOrder);
  });

  it("getOfficeBreakdown groups volume by assigned office name", async () => {
    await seedDeterministicComplaints();
    const result = await getOfficeBreakdown({});
    const byOffice = Object.fromEntries(result.map((r) => [r.office, r.volume]));
    expect(byOffice["Office A"]).toBe(2);
    expect(byOffice["Office B"]).toBe(1);
  });

  it("getSlaComplianceByOffice computes compliant/total/percent per office, over resolved/closed complaints only", async () => {
    await seedDeterministicComplaints();
    const result = await getSlaComplianceByOffice();

    const officeA = result.find((r) => r.office === "Office A")!;
    expect(officeA.total).toBe(1); // only the resolved one counts (submitted excluded)
    expect(officeA.compliant).toBe(1);
    expect(officeA.percent).toBe(100);

    const officeB = result.find((r) => r.office === "Office B")!;
    expect(officeB.total).toBe(1);
    expect(officeB.compliant).toBe(0);
    expect(officeB.percent).toBe(0);
  });
});

describe("analytics.service — BR-090 (live, not batched)", () => {
  it("re-querying after mutating a complaint's status immediately reflects the change", async () => {
    const { officeA, categoryX, student } = await seedDeterministicComplaints();

    const before = await getPriorityBreakdown({});
    const highBefore = before.find((r) => r.priority === "high")!.volume;

    // Add one more high-priority complaint directly via the model (no
    // caching layer to invalidate — proves live aggregation per BR-090).
    await Complaint.create({
      ticketNumber: "T-4",
      studentRef: student._id,
      categoryRef: categoryX._id,
      title: "Four",
      description: "Test description long enough to pass validation",
      priority: "high",
      status: "submitted",
      assignedOfficeRef: officeA._id,
    });

    const after = await getPriorityBreakdown({});
    const highAfter = after.find((r) => r.priority === "high")!.volume;

    expect(highAfter).toBe(highBefore + 1);
  });
});
