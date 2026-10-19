import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
const mocks = vi.hoisted(() => ({ guard: vi.fn(), plan: vi.fn(), apply: vi.fn(), audit: vi.fn() }));
vi.mock("@/lib/api-guards", () => ({ requireAdmin: mocks.guard }));
vi.mock("@/features/sla/services/sla-recalculation.service", () => ({
  planSlaRecalculation: mocks.plan,
  applySlaRecalculation: mocks.apply,
}));
vi.mock("@/features/audit-log/services/audit-log.service", () => ({ writeAuditLog: mocks.audit }));
import { GET, POST } from "./route";
const request = (token: string) =>
  new NextRequest("http://localhost/api/admin/sla-calendar/recalculate", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
beforeEach(() => {
  vi.clearAllMocks();
  mocks.guard.mockResolvedValue({ session: { user: { id: "admin" } } });
  mocks.plan.mockResolvedValue({ token: "current", rows: [], skipped: 0 });
  mocks.apply.mockResolvedValue({ updated: 0, skipped: 0 });
});
describe("SLA calendar admin API", () => {
  it("blocks unauthorized preview and apply requests", async () => {
    mocks.guard.mockResolvedValue({
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    });
    expect((await GET()).status).toBe(403);
    expect((await POST(request("current"))).status).toBe(403);
    expect(mocks.plan).not.toHaveBeenCalled();
  });
  it("returns a preview without applying it", async () => {
    expect((await GET()).status).toBe(200);
    expect(mocks.apply).not.toHaveBeenCalled();
  });
  it("rejects stale previews", async () => {
    expect((await POST(request("outdated"))).status).toBe(409);
    expect(mocks.apply).not.toHaveBeenCalled();
  });
  it("applies a matching preview and audits the update", async () => {
    expect((await POST(request("current"))).status).toBe(200);
    expect(mocks.apply).toHaveBeenCalled();
    expect(mocks.audit).toHaveBeenCalled();
  });
});
