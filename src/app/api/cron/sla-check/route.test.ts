import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({
  find: vi.fn(),
  update: vi.fn(),
  rule: vi.fn(),
  timeline: vi.fn(),
  warning: vi.fn(),
}));
vi.mock("@/lib/env", () => ({ env: { CRON_SECRET: "test-secret" } }));
vi.mock("@/lib/db", () => ({ connectToDatabase: vi.fn() }));
vi.mock("@/lib/osas-operations", () => ({ getOperationalOffice: async () => ({ _id: "osas" }) }));
vi.mock("@/models/Complaint", () => ({
  Complaint: { find: mocks.find, findOneAndUpdate: mocks.update },
}));
vi.mock("@/models/ComplaintTimeline", () => ({ ComplaintTimeline: { create: mocks.timeline } }));
vi.mock("@/models/SLARule", () => ({ SLARule: { findOne: mocks.rule } }));
vi.mock("@/models/Office", () => ({ Office: { findById: vi.fn() } }));
vi.mock("@/models/Assignment", () => ({ Assignment: { create: vi.fn() } }));
vi.mock("@/features/audit-log/services/audit-log.service", () => ({ writeAuditLog: vi.fn() }));
vi.mock("@/features/settings/services/settings.service", () => ({ updateSettings: vi.fn() }));
vi.mock("@/features/notifications/services/notification.service", () => ({
  notifySlaWarning: mocks.warning,
  notifyEscalation: vi.fn(),
  notifyStatusUpdated: vi.fn(),
}));
import { GET } from "./route";
const run = () =>
  GET(
    new NextRequest("http://localhost/api/cron/sla-check", {
      headers: { "x-cron-secret": "test-secret" },
    }),
  );
beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  const complaint = {
    _id: "complaint",
    categoryRef: "category",
    priority: "medium",
    status: "in_progress",
    assignedStaffRef: "staff",
    isOverdue: false,
    slaResolutionDueAt: new Date("2026-10-27T04:00:00+08:00"),
    slaPolicy: {
      version: 1,
      startedAt: new Date("2026-10-23T18:00:00+08:00"),
      holidays: ["2026-10-26"],
      responseHours: 10,
      resolutionHours: 10,
      warningThresholdPercent: 80,
    },
  };
  mocks.find.mockReturnValue({ lean: async () => [complaint] });
  // Rules may change after creation; the complaint's snapshot wins.
  mocks.rule.mockReturnValue({
    lean: async () => ({ responseHours: 1, resolutionHours: 1, warningThresholdPercent: 10 }),
  });
  mocks.update.mockResolvedValue(complaint);
});
afterEach(() => vi.useRealTimers());
describe("SLA warnings use eligible hours", () => {
  it.each(["2026-10-24T23:00:00+08:00", "2026-10-25T23:00:00+08:00", "2026-10-26T23:00:00+08:00"])(
    "does not advance through the excluded date %s",
    async (now) => {
      vi.setSystemTime(new Date(now));
      const response = await run();
      expect((await response.json()).warned).toBe(0);
      expect(mocks.warning).not.toHaveBeenCalled();
    },
  );
  it("warns when the eligible elapsed time reaches the saved threshold", async () => {
    vi.setSystemTime(new Date("2026-10-27T02:00:00+08:00"));
    expect((await (await run()).json()).warned).toBe(1);
    expect(mocks.warning).toHaveBeenCalledWith(
      expect.objectContaining({ warningThresholdPercent: 80 }),
    );
  });
});
