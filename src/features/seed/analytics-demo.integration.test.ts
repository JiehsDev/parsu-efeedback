/* eslint-disable @typescript-eslint/no-require-imports */
import { afterAll, beforeAll, expect, it } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { seedDevelopmentData } from "./seed.service";
import {
  Complaint,
  User,
  Assignment,
  ComplaintTimeline,
  ForwardingRequest,
  InformationRequest,
  AuditLog,
  Office,
  Category,
} from "@/models";
import {
  getAnalyticsSummary,
  getMonthlyTrends,
  getCategoryBreakdown,
  getPriorityBreakdown,
  getOfficeBreakdown,
  getCollegeComparison,
  getSlaTrendSeries,
} from "@/features/analytics/services/analytics.service";
import { queryReportData } from "@/features/reports/services/report-data.service";
import { complaintFilterForScope, getAdminScope } from "@/lib/admin-scope";
import { addSlaHours } from "@/lib/sla-calendar";
const { seedAnalyticsDemo } = require("../../../scripts/seed-analytics.cjs");
let mongo: MongoMemoryReplSet;
let directory: string;
beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({
    replSet: { count: 1 },
    instanceOpts: [{ args: ["--setParameter", "indexBuildMinAvailableDiskSpaceMB=128"] }],
  });
  await mongoose.connect(mongo.getUri());
  await seedDevelopmentData();
  directory = mkdtempSync(join(tmpdir(), "analytics-demo-test-"));
}, 90000);
afterAll(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
  if (directory) rmSync(directory, { recursive: true, force: true });
});
const snapshot = async () => {
  const db = mongoose.connection.db!;
  const names = (await db.listCollections().toArray()).map((row) => row.name);
  return Object.fromEntries(
    await Promise.all(
      names.map(async (name) => [
        name,
        JSON.stringify(await db.collection(name).find().sort({ _id: 1 }).toArray()),
      ]),
    ),
  );
};
it("previews without writes, imports valid histories atomically, preserves existing data, and populates scoped analytics and report filters", async () => {
  const db = mongoose.connection.db!;
  const original = await snapshot();
  const now = new Date();
  const preview = await seedAnalyticsDemo(db, { now });
  expect(preview).toMatchObject({ applied: false, complaints: 180, demoStudents: 15, months: 6 });
  expect(await snapshot()).toEqual(original);
  const result = await seedAnalyticsDemo(db, { apply: true, now, backupDirectory: directory });
  expect(result).toMatchObject({ applied: true, complaints: 180, existingRecordsPreserved: true });
  const complaints = await Complaint.find({ ticketNumber: /^DEMO-ANALYTICS-/ }).lean();
  expect(complaints).toHaveLength(180);
  expect(await User.countDocuments({ email: /@demo\.invalid$/, isActive: false })).toBe(15);
  for (const Model of [
    Complaint,
    User,
    Assignment,
    ComplaintTimeline,
    ForwardingRequest,
    InformationRequest,
    AuditLog,
  ] as mongoose.Model<any>[]) {
    const documents = await Model.find().lean();
    // Validation includes existing enum rules and actual reference integrity.
    await Promise.all(documents.map((row: any) => Model.hydrate(row).validate()));
  }
  const osas = (await Office.findOne({ code: "OSAS" }))!;
  for (const complaint of complaints) {
    expect(String(complaint.initialOfficeRef)).toBe(String(osas._id));
    expect(complaint.submittedAt.getTime()).toBeLessThanOrEqual(now.getTime());
    expect(complaint.slaResolutionDueAt!.getTime()).toBe(
      addSlaHours(
        complaint.submittedAt,
        complaint.slaPolicy!.resolutionHours,
        complaint.slaPolicy!.holidays,
      ).getTime(),
    );
    if (complaint.resolvedAt) {
      expect(complaint.resolvedAt.getTime()).toBeLessThan(now.getTime());
      expect(complaint.resolvedAt.getTime()).toBeGreaterThan(complaint.submittedAt.getTime());
    }
    if (complaint.forwardedToRole) {
      const request = (await ForwardingRequest.findOne({ complaintRef: complaint._id }))!;
      expect(request.status).toBe("approved");
      expect(String(request.reviewedByUserRef)).toBe(String(osas.headUserRef));
      expect(String(request.destinationOfficeRef)).toBe(String(complaint.assignedOfficeRef));
      expect(request.reviewedAt!.getTime()).toBe(complaint.forwardedAt!.getTime());
      expect(complaint.forwardedAt!.getTime()).toBeGreaterThan(complaint.submittedAt.getTime());
      if (complaint.resolvedAt)
        expect(complaint.resolvedAt.getTime()).toBeGreaterThan(complaint.forwardedAt!.getTime());
    } else expect(String(complaint.assignedOfficeRef)).toBe(String(osas._id));
  }
  for (const entry of await ComplaintTimeline.find().lean())
    expect(entry.createdAt.getTime()).toBeLessThanOrEqual(now.getTime());
  const scope = { ticketNumber: /^DEMO-ANALYTICS-/, isArchived: false };
  const summary = await getAnalyticsSummary(scope);
  expect(summary.totalComplaints).toBeGreaterThan(160);
  expect(summary.overdueComplaints).toBeGreaterThan(0);
  expect(summary.averageFirstResponseHours).toBeGreaterThan(0);
  expect(summary.averageResolutionHours).toBeGreaterThan(0);
  expect(summary.ratedClosures).toBeGreaterThan(0);
  expect(summary.closedWithoutRating).toBeGreaterThan(0);
  expect(summary.slaComplianceRate).toBeGreaterThan(0);
  expect(summary.slaComplianceRate).toBeLessThan(100);
  expect((await getMonthlyTrends(scope)).length).toBe(6);
  expect((await getCategoryBreakdown(scope)).length).toBeGreaterThan(25);
  expect((await getPriorityBreakdown(scope)).length).toBeGreaterThanOrEqual(3);
  expect((await getOfficeBreakdown(scope)).length).toBe(3);
  expect((await getCollegeComparison(6, scope)).length).toBe(5);
  expect((await getSlaTrendSeries({ year: now.getFullYear() })).length).toBeGreaterThan(0);
  for (const role of ["vpaa", "vpaf"] as const) {
    const rows = await queryReportData(
      {},
      { ...scope, ...(await complaintFilterForScope(getAdminScope(role))) },
    );
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((row) => row.forwardedTo === role.toUpperCase())).toBe(true);
  }
  const category = (await Category.findOne({ group: "vpaa", isActive: true }))!;
  const rows = await queryReportData({ categoryRef: String(category._id) }, scope);
  expect(rows.length).toBeGreaterThan(0);
  expect(rows.every((row) => row.categoryName === category.name)).toBe(true);
  expect((await queryReportData({ slaOnly: true }, scope)).length).toBeGreaterThan(0);
  const after = await snapshot();
  expect(await seedAnalyticsDemo(db, { apply: true, backupDirectory: directory })).toMatchObject({
    applied: false,
    alreadySeeded: true,
    complaints: 180,
  });
  expect(await snapshot()).toEqual(after);
}, 90000);
