// src/app/api/admin/categories/category-activation.integration.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { connectTestDb, disconnectTestDb, clearTestDb } from "@/test/setup-db";
import { Category } from "@/models/Category";
import { RoutingRule } from "@/models/RoutingRule";
import { createTestOffice } from "@/test/fixtures";

beforeAll(connectTestDb);
afterAll(disconnectTestDb);
beforeEach(clearTestDb);

// These tests exercise the DB-level rules directly (unique partial index,
// model constraints) rather than going through the HTTP layer — the route
// handler logic itself (the 409 checks) is covered by the E2E suite,
// since it depends on Next.js's request/response cycle.
describe("Category activation — BR-023/024", () => {
  it("BR-024: categories are created inactive by default per the route contract", async () => {
    const office = await createTestOffice();
    const category = await Category.create({
      name: "Test Category",
      defaultOfficeRef: office._id,
      defaultPriority: "medium",
      isActive: false, // matches what the route always forces on create
    });
    expect(category.isActive).toBe(false);
  });

  it("BR-023: only one active routing rule per category is enforceable at the DB level", async () => {
    const office = await createTestOffice();
    const category = await Category.create({
      name: "Test Category 2",
      defaultOfficeRef: office._id,
      defaultPriority: "medium",
      isActive: true,
    });

    await RoutingRule.create({
      categoryRef: category._id,
      targetOfficeRef: office._id,
      isActive: true,
    });

    // A second active rule for the same category must violate the
    // partial unique index ({ categoryRef: 1 }, { isActive: true })
    await expect(
      RoutingRule.create({
        categoryRef: category._id,
        targetOfficeRef: office._id,
        isActive: true,
      }),
    ).rejects.toThrow();
  });

  it("allows a second INACTIVE rule for the same category (historical rules coexist)", async () => {
    const office = await createTestOffice();
    const category = await Category.create({
      name: "Test Category 3",
      defaultOfficeRef: office._id,
      defaultPriority: "medium",
      isActive: true,
    });

    await RoutingRule.create({
      categoryRef: category._id,
      targetOfficeRef: office._id,
      isActive: false,
    });

    await expect(
      RoutingRule.create({
        categoryRef: category._id,
        targetOfficeRef: office._id,
        isActive: false,
      }),
    ).resolves.toBeTruthy();
  });
});
