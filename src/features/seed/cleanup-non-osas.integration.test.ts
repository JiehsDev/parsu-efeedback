/* eslint-disable @typescript-eslint/no-require-imports */
import { afterAll, beforeAll, expect, it } from "vitest";
import mongoose from "mongoose";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { connectTestDb, disconnectTestDb, clearTestDb } from "@/test/setup-db";
import { seedDevelopmentData } from "./seed.service";
const { cleanupNonOsas } = require("../../../scripts/cleanup-non-osas.cjs");
beforeAll(connectTestDb);
afterAll(disconnectTestDb);

it("removes unrelated fixtures and logins while preserving OSAS data and historical references", async () => {
  await clearTestDb();
  await seedDevelopmentData();
  const db = mongoose.connection.db!;
  const id = () => new mongoose.Types.ObjectId();
  const foreignOffice = id(),
    foreignCategory = id(),
    historicalCategory = id();
  const unusedStaff = id(),
    historicalStaff = id(),
    demo = id(),
    original = id();
  await db.collection("categories").insertMany([
    { _id: foreignCategory, name: "ICT demo", domain: "ict", isActive: true },
    { _id: historicalCategory, name: "Academic history", domain: "academic", isActive: true },
  ]);
  await db.collection("users").insertMany([
    { _id: unusedStaff, email: "unused@example.test", employeeOrStudentId: "UNUSED", role: "office_staff", officeRef: foreignOffice, isActive: true },
    {
      _id: historicalStaff,
      email: "historical@example.test",
      employeeOrStudentId: "HISTORICAL",
      role: "office_staff",
      officeRef: foreignOffice,
      isActive: true,
      tokenVersion: 0,
    },
  ]);
  await db.collection("complaints").insertMany([
    { _id: demo, ticketNumber: "DEMO-OSAS-9999", categoryRef: foreignCategory },
    {
      _id: original,
      ticketNumber: "PARSU-KEEP",
      categoryRef: historicalCategory,
      resolvedByRef: historicalStaff,
    },
  ]);
  await db.collection("complaint_timeline").insertOne({ complaintRef: demo });
  const usersBefore = await db.collection("users").countDocuments();
  const preview = await cleanupNonOsas(db);
  expect(preview.demoComplaintsToRemove).toBe(1);
  expect(await db.collection("users").countDocuments()).toBe(usersBefore);
  const backupDirectory = mkdtempSync(join(tmpdir(), "osas-cleanup-"));
  try {
    const result = await cleanupNonOsas(db, { apply: true, backupDirectory });
    expect(result.staffDeleted).toBe(1);
    expect(result.staffDisabledForHistory).toBe(1);
    expect(readFileSync(result.backupFile, "utf8")).toContain("DEMO-OSAS-9999");
    expect(await db.collection("complaints").findOne({ _id: demo })).toBeNull();
    expect(await db.collection("complaint_timeline").countDocuments({ complaintRef: demo })).toBe(
      0,
    );
    expect(await db.collection("complaints").findOne({ _id: original })).toBeTruthy();
    expect(await db.collection("categories").findOne({ _id: foreignCategory })).toBeNull();
    expect((await db.collection("categories").findOne({ _id: historicalCategory }))?.isActive).toBe(
      false,
    );
    expect(await db.collection("categories").countDocuments({ isActive: true })).toBe(5);
    expect((await db.collection("users").findOne({ _id: historicalStaff }))?.isActive).toBe(false);
    expect(await db.collection("users").findOne({ _id: unusedStaff })).toBeNull();
    expect(
      await db.collection("users").countDocuments({ isActive: true, role: "office_staff" }),
    ).toBe(2);
  } finally {
    rmSync(backupDirectory, { recursive: true, force: true });
  }
}, 60000);
