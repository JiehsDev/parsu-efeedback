import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), connect: vi.fn(), data: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/db", () => ({ connectToDatabase: mocks.connect }));
vi.mock("@/features/dashboard/services/dashboard-data.service", () => ({
  getDashboardData: mocks.data,
}));
import { GET } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.data.mockResolvedValue({ openCount: 1, queue: [] });
});

it.each(["administrator", "osas", "vpaa", "vpaf", "office_staff"])(
  "passes the authenticated %s identity to the scoped data service",
  async (role) => {
    const session = { user: { id: `user-${role}`, role, officeRef: "OSAS", tokenVersion: 2 } };
    mocks.auth.mockResolvedValue(session);
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ openCount: 1, queue: [] });
    expect(mocks.data).toHaveBeenCalledExactlyOnceWith(session);
  },
);

it("does not query private dashboard data for a student", async () => {
  mocks.auth.mockResolvedValue({ user: { id: "student", role: "student" } });
  expect((await GET()).status).toBe(403);
  expect(mocks.data).not.toHaveBeenCalled();
  expect(mocks.connect).not.toHaveBeenCalled();
});

it("does not query private dashboard data without a session", async () => {
  mocks.auth.mockResolvedValue(null);
  expect((await GET()).status).toBe(401);
  expect(mocks.data).not.toHaveBeenCalled();
  expect(mocks.connect).not.toHaveBeenCalled();
});
