import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
const email = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db", () => ({ connectToDatabase: vi.fn() }));
vi.mock("./email.service", () => ({ sendEscalationEmail: email }));
import { connectTestDb, disconnectTestDb, clearTestDb } from "@/test/setup-db";
import { createTestOffice, createTestCategory, createTestUser } from "@/test/fixtures";
import { Complaint } from "@/models/Complaint";
import { Notification } from "@/models/Notification";
import { notifyEscalation } from "./notification.service";

beforeAll(connectTestDb);
afterAll(disconnectTestDb);
beforeEach(async () => {
  await clearTestDb();
  vi.clearAllMocks();
});

describe("OSAS notification privacy", () => {
  it.each(["vpaa", "vpaf", "osas"] as const)(
    "checks %s access before creating notifications or sending email",
    async (role) => {
      const office = await createTestOffice({ code: "OSAS" });
      const category = await createTestCategory({ defaultOfficeRef: office._id });
      const student = await createTestUser();
      const recipient = await createTestUser({ role });
      const complaint = await Complaint.create({
        ticketNumber: "PRIVATE-OSAS",
        studentRef: student._id,
        categoryRef: category._id,
        title: "Private complaint",
        description: "A private student affairs complaint.",
        priority: "medium",
        assignedOfficeRef: office._id,
      });
      await notifyEscalation({
        staffId: String(recipient._id),
        ticketNumber: complaint.ticketNumber,
        complaintId: String(complaint._id),
      });
      expect(await Notification.countDocuments({ userRef: recipient._id })).toBe(
        role === "osas" ? 1 : 0,
      );
      expect(email).toHaveBeenCalledTimes(role === "osas" ? 1 : 0);
    },
  );
});
