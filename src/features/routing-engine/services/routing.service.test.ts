import { beforeEach, describe, it, expect, vi } from "vitest";
const office = vi.hoisted(() => vi.fn());
vi.mock("@/lib/osas-operations", () => ({ getOperationalOffice: office }));
import { resolveRoutingOffice, RoutingError } from "./routing.service";
beforeEach(() => vi.clearAllMocks());
describe("centralized routing", () => {
  it.each(["ict", "health", "academic", "administrative"])(
    "routes %s to OSAS without legacy rules",
    async (categoryId) => {
      office.mockResolvedValue({ _id: "osas-office" });
      expect(
        await resolveRoutingOffice({ categoryId, studentCollegeRef: null, priority: "high" }),
      ).toEqual({ officeRef: "osas-office" });
    },
  );
  it("fails closed when OSAS is unavailable", async () => {
    office.mockResolvedValue(null);
    await expect(
      resolveRoutingOffice({ categoryId: "category", studentCollegeRef: null, priority: "medium" }),
    ).rejects.toBeInstanceOf(RoutingError);
  });
});
