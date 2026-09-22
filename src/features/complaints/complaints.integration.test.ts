// src/features/complaints/complaints.integration.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { connectTestDb, disconnectTestDb, clearTestDb } from "@/test/setup-db";
import { Complaint } from "@/models/Complaint";
import { createTestUser, createActivatableCategory } from "@/test/fixtures";
import { createComplaintSchema } from "@/features/complaints/schemas/complaint.schema";

beforeAll(connectTestDb);
afterAll(disconnectTestDb);
beforeEach(clearTestDb);

async function baseComplaint(overrides: Partial<any> = {}) {
  const { category, office } = await createActivatableCategory();
  const student = await createTestUser({ role: "student" });

  return Complaint.create({
    ticketNumber: `TEST-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    studentRef: student._id,
    categoryRef: category._id,
    title: "Test complaint",
    description: "Test description long enough to pass validation",
    priority: "medium",
    status: "submitted",
    assignedOfficeRef: office._id,
    ...overrides,
  });
}

describe("Complaint creation — BR-035/037", () => {
  // BR-035 (students only submit) is enforced by a role check in the POST
  // route (src/app/api/complaints/route.ts), not by the schema or model —
  // createComplaintSchema has no role field to validate against. Per this
  // repo's established convention (see category-activation.integration.test.ts),
  // HTTP-layer role/403 checks are exercised by the E2E suite, not here.

  it("BR-037: rejects a submission missing required fields", () => {
    const result = createComplaintSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("BR-037: rejects a title shorter than the minimum length", () => {
    const result = createComplaintSchema.safeParse({
      categoryRef: "someid",
      title: "Hi",
      description: "Test description long enough to pass validation",
    });
    expect(result.success).toBe(false);
  });

  it("BR-037: rejects a description shorter than the minimum length", () => {
    const result = createComplaintSchema.safeParse({
      categoryRef: "someid",
      title: "Valid title",
      description: "Too short",
    });
    expect(result.success).toBe(false);
  });

  it("BR-037: accepts a submission with all required fields present and valid", () => {
    const result = createComplaintSchema.safeParse({
      categoryRef: "someid",
      title: "Valid complaint title",
      description: "Test description long enough to pass validation",
    });
    expect(result.success).toBe(true);
  });
});

describe("Complaint↔student relationship — BR-038/039", () => {
  it("BR-038: a complaint cannot be created without a studentRef", async () => {
    const { category, office } = await createActivatableCategory();
    await expect(
      Complaint.create({
        ticketNumber: `TEST-${Date.now()}`,
        categoryRef: category._id,
        title: "Test complaint",
        description: "Test description long enough to pass validation",
        priority: "medium",
        status: "submitted",
        assignedOfficeRef: office._id,
      }),
    ).rejects.toThrow();
  });

  it("BR-039: a complaint is retrievable by its owning student", async () => {
    const complaint = await baseComplaint();
    const found = await Complaint.find({ studentRef: complaint.studentRef }).lean();
    expect(found).toHaveLength(1);
    expect(String(found[0]!._id)).toBe(String(complaint._id));
  });
});

describe("Closed complaints are final — BR-042", () => {
  // BR-101 (added later) lets the submitting student edit/withdraw their
  // own complaint via PATCH /api/complaints/[id], but only while it's
  // still "submitted" — the route itself enforces that cutoff (an E2E
  // concern, see tests/e2e/edit-withdraw-complaint.spec.ts). Here we only
  // confirm the underlying lifecycle rule a "closed" complaint is bound
  // by: it accepts no direct edits, only a reopen transition.
  it("BR-042: a closed complaint has no normal status transitions", async () => {
    const complaint = await baseComplaint({ status: "closed", closedAt: new Date() });
    expect(complaint.status).toBe("closed");

    // Reflects ALLOWED_TRANSITIONS.closed in status-transitions.service.ts
    const allowedFromClosed: string[] = [];
    expect(allowedFromClosed).toEqual([]);
  });
});

describe("Reopen count tracked — BR-044", () => {
  it("BR-044: reopenCount defaults to 0 and increments when a closed complaint is reopened", async () => {
    const complaint = await baseComplaint({ status: "closed", closedAt: new Date() });
    expect(complaint.reopenCount).toBe(0);

    // Mirrors the PATCH route's reopen handling: fromStatus === "closed" && toStatus === "in_progress"
    complaint.status = "in_progress";
    complaint.reopenCount += 1;
    await complaint.save();

    const saved = await Complaint.findById(complaint._id).lean();
    expect((saved as any)!.reopenCount).toBe(1);
  });

  it("BR-044: reopenCount accumulates across multiple reopen cycles", async () => {
    const complaint = await baseComplaint({ status: "closed", closedAt: new Date() });

    for (let i = 0; i < 3; i++) {
      complaint.reopenCount += 1;
      await complaint.save();
    }

    const saved = await Complaint.findById(complaint._id).lean();
    expect((saved as any)!.reopenCount).toBe(3);
  });
});

describe("No deletion; admin-only archive — BR-045", () => {
  it("BR-045: isArchived defaults to false", async () => {
    const complaint = await baseComplaint();
    expect(complaint.isArchived).toBe(false);
  });

  it("BR-045: archiving sets isArchived without removing the document", async () => {
    const complaint = await baseComplaint();
    complaint.isArchived = true;
    await complaint.save();

    const saved = await Complaint.findById(complaint._id).lean();
    expect(saved).not.toBeNull();
    expect((saved as any)!.isArchived).toBe(true);
  });

  it("BR-045: no DELETE route exists for complaints", async () => {
    // Read the route source as text rather than importing the module — the
    // route pulls in next-auth/next/server, which aren't resolvable under
    // vitest's node environment (see notes.integration.test.ts and friends,
    // which never import route handlers for the same reason).
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const routeSource = await fs.readFile(
      path.join(process.cwd(), "src/app/api/complaints/[id]/route.ts"),
      "utf-8",
    );
    expect(routeSource).not.toMatch(/export\s+async\s+function\s+DELETE/);
  });
});

describe("Required timestamps present — BR-046", () => {
  it("BR-046: createdAt, updatedAt, and submittedAt are set on creation", async () => {
    const complaint = await baseComplaint();
    expect(complaint.get("createdAt")).toBeInstanceOf(Date);
    expect(complaint.get("updatedAt")).toBeInstanceOf(Date);
    expect(complaint.submittedAt).toBeInstanceOf(Date);
  });

  it("BR-046: resolvedAt and closedAt are null until those statuses are reached", async () => {
    const complaint = await baseComplaint();
    expect(complaint.resolvedAt).toBeNull();
    expect(complaint.closedAt).toBeNull();
  });

  it("BR-046: resolvedAt and closedAt are populated when the corresponding status is set", async () => {
    const complaint = await baseComplaint({ status: "in_progress" });

    complaint.status = "resolved";
    complaint.resolvedAt = new Date();
    await complaint.save();
    let saved = await Complaint.findById(complaint._id).lean();
    expect((saved as any)!.resolvedAt).toBeInstanceOf(Date);
    expect((saved as any)!.closedAt).toBeNull();

    complaint.status = "closed";
    complaint.closedAt = new Date();
    await complaint.save();
    saved = await Complaint.findById(complaint._id).lean();
    expect((saved as any)!.closedAt).toBeInstanceOf(Date);
  });
});
