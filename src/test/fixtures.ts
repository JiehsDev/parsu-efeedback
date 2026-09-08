// src/test/fixtures.ts
import { User } from "@/models/User";
import { Office } from "@/models/Office";
import { Category } from "@/models/Category";
import { RoutingRule } from "@/models/RoutingRule";
import { SLARule } from "@/models/SLARule";
import { hashPassword } from "@/lib/password";

export async function createTestOffice(overrides: Partial<any> = {}) {
  return Office.create({
    name: "Test Office",
    code: `OFF-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type: "university_office",
    isActive: true,
    ...overrides,
  });
}

export async function createTestCollege(overrides: Partial<any> = {}) {
  return Office.create({
    name: "Test College",
    code: `COL-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type: "college_office",
    isActive: true,
    ...overrides,
  });
}

export async function createTestUser(overrides: Partial<any> = {}) {
  const passwordHash = await hashPassword("TestPass123!");
  return User.create({
    firstName: "Test",
    lastName: "User",
    email: `test-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@test.com`,
    employeeOrStudentId: `ID-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    passwordHash,
    role: "student",
    isActive: true,
    tokenVersion: 0,
    ...overrides,
  });
}

export async function createTestCategory(overrides: Partial<any> = {}) {
  const office = overrides.defaultOfficeRef ? null : await createTestOffice();
  return Category.create({
    name: `Category-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    defaultOfficeRef: overrides.defaultOfficeRef ?? office!._id,
    defaultPriority: "medium",
    isActive: true,
    ...overrides,
  });
}

export async function createTestRoutingRule(
  categoryId: string,
  officeId: string,
  overrides: Partial<any> = {},
) {
  return RoutingRule.create({
    categoryRef: categoryId,
    targetOfficeRef: officeId,
    conditions: {},
    priority: 0,
    isActive: true,
    ...overrides,
  });
}

export async function createTestSlaRule(categoryId: string | null, overrides: Partial<any> = {}) {
  return SLARule.create({
    categoryRef: categoryId,
    priority: "medium",
    responseHours: 24,
    resolutionHours: 72,
    warningThresholdPercent: 80,
    isActive: true,
    ...overrides,
  });
}

// Fully wires a category so it can pass activation (routing rule + SLA rule)
export async function createActivatableCategory() {
  const office = await createTestOffice();
  const category = await createTestCategory({ defaultOfficeRef: office._id, isActive: false });
  await createTestRoutingRule(String(category._id), String(office._id));
  await createTestSlaRule(String(category._id));
  category.isActive = true;
  await category.save();
  return { category, office };
}
