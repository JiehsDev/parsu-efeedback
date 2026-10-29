/* eslint-disable @typescript-eslint/no-require-imports */
import { afterAll, beforeAll, expect, it } from "vitest";
import mongoose from "mongoose";
import { connectTestDb, disconnectTestDb } from "@/test/setup-db";
import { seedDevelopmentData } from "./seed.service";
import { Complaint, ForwardingRequest, Office, User } from "@/models";
const { seedDemo } = require("../../../scripts/seed-demo.cjs");
beforeAll(connectTestDb);
afterAll(disconnectTestDb);
it("seeds configuration and receiving accounts with zero tickets, and retires ticket demo seeding", async () => {
  const result = await seedDevelopmentData();
  expect(result.counts.complaints).toBe(0);
  expect(await Complaint.countDocuments()).toBe(0);
  expect(await ForwardingRequest.countDocuments()).toBe(0);
  for (const role of ["vpaa", "vpaf"] as const) {
    const office = await Office.findOne({ code: role === "vpaa" ? "OVPAA" : "OVPAF" });
    const user = await User.findOne({ role });
    expect(String(office!.headUserRef)).toBe(String(user!._id));
    expect(String(user!.officeRef)).toBe(String(office!._id));
  }
  await expect(seedDemo()).rejects.toThrow("retired");
  expect(await Complaint.countDocuments()).toBe(0);
});

it("repeated configuration seeds preserve existing complaint, forwarding, user, and history records", async () => {
  await seedDevelopmentData();
  const db = mongoose.connection.db!;
  const complaintId = new mongoose.Types.ObjectId();
  const collections = [
    "complaints",
    "forwarding_requests",
    "complaint_timeline",
    "assignments",
    "audit_logs",
    "attachments",
    "complaint_notes",
    "information_requests",
    "archive_requests",
    "notifications",
  ];
  for (const name of collections)
    await db.collection(name).insertOne({
      _id: new mongoose.Types.ObjectId(),
      complaintRef: complaintId,
      marker: "preserve existing records",
      createdAt: new Date("2026-01-01"),
    });
  const before = Object.fromEntries(
    await Promise.all(
      collections.map(async (name) => [
        name,
        JSON.stringify(await db.collection(name).find().sort({ _id: 1 }).toArray()),
      ]),
    ),
  );
  const users = JSON.stringify(
    await db.collection("users").find().sort({ _id: 1 }).project({ _id: 1 }).toArray(),
  );
  await seedDevelopmentData();
  await seedDevelopmentData();
  for (const name of collections)
    expect(JSON.stringify(await db.collection(name).find().sort({ _id: 1 }).toArray())).toBe(
      before[name],
    );
  expect(
    JSON.stringify(
      await db.collection("users").find().sort({ _id: 1 }).project({ _id: 1 }).toArray(),
    ),
  ).toBe(users);
});
