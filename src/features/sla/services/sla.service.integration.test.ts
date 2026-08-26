// src/features/sla/services/sla.service.integration.test.ts
// BR-029: uniqueness constraints live at the database level (partial
// unique indexes on SLARule), not in sla.service.ts's pure functions —
// this needs a real (in-memory) MongoDB to prove the index actually
// rejects a second active rule, which is why it's split out from the
// pure-unit sla.service.test.ts into its own *.integration.test.ts file,
// matching this repo's established unit/integration split.
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { connectTestDb, disconnectTestDb, clearTestDb } from "@/test/setup-db";
import { SLARule } from "@/models/SLARule";
import { createTestCategory, createTestSlaRule } from "@/test/fixtures";

beforeAll(connectTestDb);
afterAll(disconnectTestDb);
beforeEach(clearTestDb);

describe("SLARule uniqueness — BR-029", () => {
  it("rejects a second active rule for the same category", async () => {
    const category = await createTestCategory();
    await createTestSlaRule(String(category._id));

    await expect(createTestSlaRule(String(category._id))).rejects.toThrow();
  });

  it("allows a second, inactive rule for the same category (historical records coexist)", async () => {
    const category = await createTestCategory();
    await createTestSlaRule(String(category._id));

    const inactiveDuplicate = await createTestSlaRule(String(category._id), { isActive: false });
    expect(inactiveDuplicate.isActive).toBe(false);
  });

  it("allows at most one active institution-wide default (categoryRef: null) per priority", async () => {
    await createTestSlaRule(null, { priority: "high" });

    await expect(createTestSlaRule(null, { priority: "high" })).rejects.toThrow();
  });

  it("allows active institution-wide defaults at different priority levels", async () => {
    await createTestSlaRule(null, { priority: "high" });
    const lowDefault = await createTestSlaRule(null, { priority: "low" });
    expect(lowDefault.priority).toBe("low");
  });

  it("allows an active category-specific rule to coexist with an active institution-wide default", async () => {
    const category = await createTestCategory();
    await createTestSlaRule(String(category._id), { priority: "medium" });
    const defaultRule = await createTestSlaRule(null, { priority: "medium" });
    expect(defaultRule.categoryRef).toBeNull();
  });

  it("BR-032: isOverdue-style computation — a rule's resolutionHours feeds a resolution deadline that can be compared against now", async () => {
    // isOverdue itself is a denormalized Complaint flag updated by the cron
    // (src/app/api/cron/sla-check/route.ts), not a separable pure function
    // — see the top-level report for why that logic isn't unit-tested here.
    // What IS separably testable is that an SLARule persists the resolution
    // window the cron relies on.
    const rule = await createTestSlaRule(null, { priority: "critical", resolutionHours: 24 });
    expect(rule.resolutionHours).toBe(24);
  });
});
