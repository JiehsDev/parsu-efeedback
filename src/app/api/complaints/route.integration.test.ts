import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), routing: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/db", () => ({ connectToDatabase: vi.fn() }));
vi.mock("@/features/settings/services/settings.service", () => ({
  getSettings: async () => ({ slaHolidays: ["2026-10-26"] }),
}));
vi.mock("@/features/complaints/services/ticket-number.service", () => ({
  generateTicketNumber: async () => "TEST-SUBMISSION-CALENDAR",
}));
vi.mock("@/features/routing-engine/services/routing.service", () => ({
  resolveRoutingOffice: mocks.routing,
  RoutingError: class extends Error {},
}));
vi.mock("@/features/audit-log/services/audit-log.service", () => ({ writeAuditLog: vi.fn() }));
vi.mock("@/features/notifications/services/notification.service", () => ({
  notifyComplaintRoutedToOffice: vi.fn(),
  notifyComplaintSubmitted: vi.fn(),
}));

import { connectTestDb, disconnectTestDb, clearTestDb } from "@/test/setup-db";
import { createActivatableCategory, createTestUser } from "@/test/fixtures";
import { Complaint } from "@/models/Complaint";
import { POST } from "./route";

beforeAll(connectTestDb);
afterAll(disconnectTestDb);
beforeEach(clearTestDb);
afterEach(() => vi.useRealTimers());

describe("complaint submission with a weekday calendar", () => {
  it("persists both adjusted deadlines and the calendar/rule snapshot", async () => {
    const { category, office } = await createActivatableCategory();
    const student = await createTestUser({ role: "student" });
    mocks.auth.mockResolvedValue({ user: { id: String(student._id), role: "student" } });
    mocks.routing.mockResolvedValue({ officeRef: String(office._id) });
    vi.useFakeTimers({ toFake: ["Date"] });
    const start = new Date("2026-10-23T18:00:00+08:00");
    vi.setSystemTime(start);
    const response = await POST(
      new NextRequest("http://localhost/api/complaints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryRef: String(category._id),
          title: "Internet connection issue",
          description: "The campus internet connection repeatedly disconnects during classes.",
        }),
      }),
    );
    expect(response.status).toBe(201);
    const saved = (await Complaint.findOne({ ticketNumber: "TEST-SUBMISSION-CALENDAR" }).lean())!;
    expect(saved.submittedAt).toEqual(start);
    expect(saved.slaResponseDueAt).toEqual(new Date("2026-10-27T18:00:00+08:00"));
    expect(saved.slaResolutionDueAt).toEqual(new Date("2026-10-29T18:00:00+08:00"));
    expect(saved.slaPolicy).toMatchObject({
      version: 1,
      startedAt: start,
      holidays: ["2026-10-26"],
      responseHours: 24,
      resolutionHours: 72,
      warningThresholdPercent: 80,
    });
  });
});
