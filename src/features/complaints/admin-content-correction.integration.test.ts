import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { PATCH } from "@/app/api/admin/complaints/[id]/content/route";
import { AuditLog, Complaint, ComplaintTimeline } from "@/models";
import { createTestCategory, createTestUser } from "@/test/fixtures";

const mocks = vi.hoisted(() => ({ auth: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/db", () => ({ connectToDatabase: vi.fn() }));

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
  for (const collection of Object.values(mongoose.connection.collections)) {
    await collection.deleteMany({});
  }
  vi.clearAllMocks();
});

const context = (id: unknown) => ({ params: Promise.resolve({ id: String(id) }) });
const request = (body: unknown) =>
  new NextRequest("http://localhost/api/admin/complaints/test/content", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

async function setup(status: "submitted" | "in_progress" | "resolved" | "closed" = "resolved") {
  const category = await createTestCategory();
  const student = await createTestUser({ role: "student" });
  const admin = await createTestUser({ role: "administrator" });
  const complaint = await Complaint.create({
    ticketNumber: `ADMIN-CORRECTION-${Date.now()}-${Math.random()}`,
    studentRef: student._id,
    categoryRef: category._id,
    title: "Original complaint title",
    description: "The original complaint description contains enough detail.",
    priority: "medium",
    status,
  });
  return { admin, complaint };
}

describe("admin complaint content correction", () => {
  it("allows only administrators", async () => {
    const { complaint } = await setup();
    mocks.auth.mockResolvedValue({ user: { id: "staff-id", role: "office_staff" } });

    const response = await PATCH(
      request({
        title: "Corrected complaint title",
        description: "A corrected complaint description with sufficient detail.",
        reason: "Correcting malformed test complaint text.",
      }),
      context(complaint._id),
    );

    expect(response.status).toBe(403);
    expect((await Complaint.findById(complaint._id))?.title).toBe("Original complaint title");
    expect(await AuditLog.countDocuments()).toBe(0);
  });

  it("corrects content for any non-archived status and atomically records the audit and timeline", async () => {
    const { admin, complaint } = await setup("resolved");
    mocks.auth.mockResolvedValue({ user: { id: String(admin._id), role: "administrator" } });

    const response = await PATCH(
      request({
        title: "Corrected complaint title",
        description: "A corrected complaint description with sufficient detail.",
        reason: "Replace malformed test content with approved wording.",
      }),
      context(complaint._id),
    );

    expect(response.status).toBe(200);
    const updated = await Complaint.findById(complaint._id).lean();
    expect(updated).toMatchObject({
      title: "Corrected complaint title",
      description: "A corrected complaint description with sufficient detail.",
      status: "resolved",
    });

    const [timeline] = await ComplaintTimeline.find({ complaintRef: complaint._id }).lean();
    expect(timeline).toMatchObject({
      eventType: "admin_content_corrected",
      actorRef: admin._id,
      message: "Replace malformed test content with approved wording.",
    });

    const [audit] = await AuditLog.find({ entityId: complaint._id }).lean();
    expect(audit).toMatchObject({
      actorRef: admin._id,
      action: "complaint.content_corrected",
      entityType: "Complaint",
      beforeState: {
        title: "Original complaint title",
        description: "The original complaint description contains enough detail.",
      },
      afterState: {
        title: "Corrected complaint title",
        description: "A corrected complaint description with sufficient detail.",
        reason: "Replace malformed test content with approved wording.",
      },
    });
  });

  it("rejects archived complaints without writing history", async () => {
    const { admin, complaint } = await setup("closed");
    complaint.isArchived = true;
    await complaint.save();
    mocks.auth.mockResolvedValue({ user: { id: String(admin._id), role: "administrator" } });

    const response = await PATCH(
      request({
        title: "Corrected complaint title",
        description: "A corrected complaint description with sufficient detail.",
        reason: "Replace malformed test content with approved wording.",
      }),
      context(complaint._id),
    );

    expect(response.status).toBe(409);
    expect((await Complaint.findById(complaint._id))?.title).toBe("Original complaint title");
    expect(await ComplaintTimeline.countDocuments()).toBe(0);
    expect(await AuditLog.countDocuments()).toBe(0);
  });

  it("rejects invalid correction fields without changing the complaint", async () => {
    const { admin, complaint } = await setup();
    mocks.auth.mockResolvedValue({ user: { id: String(admin._id), role: "administrator" } });

    const response = await PATCH(
      request({
        title: "x",
        description: "Too short",
        reason: "ok",
      }),
      context(complaint._id),
    );

    expect(response.status).toBe(400);
    expect((await Complaint.findById(complaint._id))?.title).toBe("Original complaint title");
    expect(await AuditLog.countDocuments()).toBe(0);
  });

  it("rejects a no-op correction", async () => {
    const { admin, complaint } = await setup();
    mocks.auth.mockResolvedValue({ user: { id: String(admin._id), role: "administrator" } });

    const response = await PATCH(
      request({
        title: "Original complaint title",
        description: "The original complaint description contains enough detail.",
        reason: "No change should be recorded here.",
      }),
      context(complaint._id),
    );

    expect(response.status).toBe(400);
    expect(await ComplaintTimeline.countDocuments()).toBe(0);
    expect(await AuditLog.countDocuments()).toBe(0);
  });
});
