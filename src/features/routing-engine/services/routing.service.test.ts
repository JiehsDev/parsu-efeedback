// src/features/routing-engine/services/routing.service.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { resolveRoutingOffice, RoutingError } from "./routing.service";
import { RoutingRule } from "@/models/RoutingRule";
import { Office } from "@/models/Office";

vi.mock("@/models/RoutingRule");
vi.mock("@/models/Office");

describe("routing.service — BR-023/025-028", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("BR-023/BR-025: throws when no active rule exists for the category", async () => {
    (RoutingRule.findOne as any).mockReturnValue({ lean: () => Promise.resolve(null) });

    await expect(
      resolveRoutingOffice({ categoryId: "cat1", studentCollegeRef: "col1", priority: "medium" }),
    ).rejects.toThrow(RoutingError);
  });

  it("BR-026: routes according to the category's active rule when conditions match", async () => {
    (RoutingRule.findOne as any).mockReturnValue({
      lean: () =>
        Promise.resolve({
          targetOfficeRef: "office1",
          conditions: { collegeRef: null, priority: null },
        }),
    });
    (Office.findById as any).mockReturnValue({
      lean: () => Promise.resolve({ isActive: true }),
    });

    const result = await resolveRoutingOffice({
      categoryId: "cat1",
      studentCollegeRef: "col1",
      priority: "medium",
    });

    expect(result.officeRef).toBe("office1");
  });

  it("BR-028: throws when the rule's target office is inactive", async () => {
    (RoutingRule.findOne as any).mockReturnValue({
      lean: () =>
        Promise.resolve({
          targetOfficeRef: "office1",
          conditions: { collegeRef: null, priority: null },
        }),
    });
    (Office.findById as any).mockReturnValue({
      lean: () => Promise.resolve({ isActive: false }),
    });

    await expect(
      resolveRoutingOffice({ categoryId: "cat1", studentCollegeRef: "col1", priority: "medium" }),
    ).rejects.toThrow(RoutingError);
  });

  it("throws when rule conditions (college/priority) don't match the complaint", async () => {
    (RoutingRule.findOne as any).mockReturnValue({
      lean: () =>
        Promise.resolve({
          targetOfficeRef: "office1",
          conditions: { collegeRef: "otherCollege", priority: null },
        }),
    });

    await expect(
      resolveRoutingOffice({ categoryId: "cat1", studentCollegeRef: "col1", priority: "medium" }),
    ).rejects.toThrow(RoutingError);
  });
});
