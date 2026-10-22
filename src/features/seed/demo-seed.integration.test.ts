/* eslint-disable @typescript-eslint/no-require-imports */
import { afterAll, beforeAll, expect, it } from "vitest";
import mongoose from "mongoose";
import { connectTestDb, disconnectTestDb, clearTestDb } from "@/test/setup-db";
import { seedDevelopmentData } from "./seed.service";
import {
  Complaint,
  ComplaintTimeline,
  Assignment,
  ComplaintNote,
  InformationRequest,
  ArchiveRequest,
  Notification,
  User,
} from "@/models";
const { seedDemo } = require("../../../scripts/seed-demo.cjs");

beforeAll(connectTestDb);
afterAll(disconnectTestDb);

it("adds valid, actionable demo scenarios and preserves data and user changes on reruns", async () => {
  await clearTestDb();
  await seedDevelopmentData();
  const db = mongoose.connection.db!;
  const now = new Date("2026-10-22T03:00:00Z");
  const student = await User.findOne({ email: "student@parsu.edu.ph" });
  const untouched = {
    _id: new mongoose.Types.ObjectId(),
    ticketNumber: "EXISTING-KEEP",
    description: "Preserve me",
  };
  await db.collection("complaints").insertOne(untouched);
  const result = await seedDemo(db, { now });
  expect(result.created).toBe(100);
  expect(result.accounts).toHaveLength(8);
  expect(await db.collection("complaints").findOne({ _id: untouched._id })).toEqual(untouched);
  expect((await User.findById(student!._id))!.passwordHash).toBe(student!.passwordHash);

  const demo = await Complaint.find({ ticketNumber: /^DEMO-OSAS-/ }).lean();
  expect(new Set(demo.map((item) => String(item.categoryRef))).size).toBe(40);
  expect(new Set(demo.map((item) => item.priority)).size).toBe(4);
  expect(new Set(demo.map((item) => item.status))).toEqual(
    new Set(["submitted", "in_progress", "pending_information", "resolved", "closed", "withdrawn"]),
  );
  expect(demo.some((item) => !item.assignedStaffRef && item.status === "submitted")).toBe(true);
  expect(demo.some((item) => item.isOverdue && item.supervisorReviewRequired)).toBe(true);
  expect(
    demo.some(
      (item) =>
        item.slaResolutionDueAt! > now &&
        item.slaResolutionDueAt!.getTime() < now.getTime() + 24 * 3600000,
    ),
  ).toBe(true);
  expect(demo.some((item) => item.closureType === "without_rating")).toBe(true);
  expect(demo.some((item) => item.studentRating === 5)).toBe(true);
  expect(demo.some((item) => item.isArchived)).toBe(true);
  expect(await InformationRequest.countDocuments({ status: "open" })).toBe(1);
  expect(await InformationRequest.countDocuments({ status: "responded" })).toBe(1);
  expect(await ArchiveRequest.countDocuments({ status: "pending" })).toBe(1);
  expect(await ArchiveRequest.countDocuments({ status: "rejected" })).toBe(1);
  for (const complaint of demo) {
    expect(complaint.updatedAt.getTime()).toBeLessThanOrEqual(now.getTime());
    expect(complaint.slaPolicy?.responseHours).toBe(72);
    expect(complaint.slaPolicy?.resolutionHours).toBe(72);
    expect(
      await User.exists({ _id: complaint.studentRef, role: "student", isActive: true }),
    ).toBeTruthy();
    if (complaint.assignedStaffRef)
      expect(
        await User.exists({
          _id: complaint.assignedStaffRef,
          officeRef: complaint.assignedOfficeRef,
        }),
      ).toBeTruthy();
  }
  // Raw-driver fixtures must conform to the application's actual model schemas.
  for (const model of [
    Complaint,
    ComplaintTimeline,
    Assignment,
    ComplaintNote,
    InformationRequest,
    ArchiveRequest,
    Notification,
    User,
  ]) {
    const filter = model.modelName === "Complaint" ? { ticketNumber: /^DEMO-OSAS-/ } : {};
    for (const document of await model.collection.find(filter).toArray()) {
      await expect(model.hydrate(document).validate()).resolves.toBeUndefined();
    }
  }
  const target = demo[0]!;
  await Complaint.updateOne({ _id: target._id }, { $set: { title: "My edited demo complaint" } });
  const countsBefore = await Promise.all(
    [
      "complaints",
      "complaint_timeline",
      "notifications",
      "assignments",
      "archive_requests",
      "information_requests",
      "audit_logs",
      "complaint_notes",
    ].map((name) => db.collection(name).countDocuments()),
  );
  const repeated = await seedDemo(db, { now });
  expect(repeated.created).toBe(0);
  expect(repeated.skipped).toBe(100);
  expect((await Complaint.findById(target._id))!.title).toBe("My edited demo complaint");
  expect(
    await Promise.all(
      [
        "complaints",
        "complaint_timeline",
        "notifications",
        "assignments",
        "archive_requests",
        "information_requests",
        "audit_logs",
        "complaint_notes",
      ].map((name) => db.collection(name).countDocuments()),
    ),
  ).toEqual(countsBefore);
  // Simulate interruption after children were written but before the parent insert.
  await Complaint.deleteOne({ _id: target._id });
  expect((await seedDemo(db, { now })).created).toBe(1);
  expect(
    await Promise.all(
      [
        "complaints",
        "complaint_timeline",
        "notifications",
        "assignments",
        "archive_requests",
        "information_requests",
        "audit_logs",
        "complaint_notes",
      ].map((name) => db.collection(name).countDocuments()),
    ),
  ).toEqual(countsBefore);
}, 60000);
