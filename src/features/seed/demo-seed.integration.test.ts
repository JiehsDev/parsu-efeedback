/* eslint-disable @typescript-eslint/no-require-imports */
import { afterAll, beforeAll, expect, it } from "vitest";
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
