/* eslint-disable @typescript-eslint/no-require-imports */
import { beforeAll, afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import mongoose from "mongoose";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), ticket: 0 }));
vi.mock("@/lib/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/db", () => ({ connectToDatabase: vi.fn() }));
vi.mock("@/lib/env", () => ({ env: {} }));
vi.mock("@/features/settings/services/settings.service", () => ({
  getSettings: async () => ({ slaHolidays: [] }),
}));
vi.mock("@/features/audit-log/services/audit-log.service", () => ({ writeAuditLog: vi.fn() }));
vi.mock("@/features/notifications/services/notification.service", () => ({
  notifyComplaintSubmitted: vi.fn(),
  notifyComplaintRoutedToOffice: vi.fn(),
}));
vi.mock("@/features/complaints/services/ticket-number.service", () => ({
  generateTicketNumber: async () => `CATALOG-TEST-${++mocks.ticket}`,
}));
import { connectTestDb, disconnectTestDb, clearTestDb } from "@/test/setup-db";
import {
  createTestOffice,
  createTestUser,
  createTestCategory,
  createTestSlaRule,
} from "@/test/fixtures";
import { Category, RoutingRule, SLARule, Complaint, Office } from "@/models";
import {
  CATEGORY_CATALOG,
  OSAS_CATEGORIES,
  RESTORED_VPAA_CATEGORIES,
  RESTORED_VPAF_CATEGORIES,
} from "./categories";
import { GET as studentCategories } from "@/app/api/categories/route";
import { POST as submitComplaint } from "@/app/api/complaints/route";
import { GET as adminCategories, POST as createCategory } from "@/app/api/admin/categories/route";
import { PATCH as updateCategory } from "@/app/api/admin/categories/[id]/route";
import { canAccessComplaint } from "@/lib/complaint-access";
const { migrateComplaintCategories } = require("../../../scripts/migrate-complaint-categories.cjs");
let backupDirectory: string;
beforeAll(async () => {
  await connectTestDb();
  backupDirectory = mkdtempSync(join(tmpdir(), "category-catalog-test-"));
});
afterAll(async () => {
  await disconnectTestDb();
  rmSync(backupDirectory, { recursive: true, force: true });
});
beforeEach(async () => {
  await clearTestDb();
  vi.clearAllMocks();
});
const migrate = (apply = true) =>
  migrateComplaintCategories(mongoose.connection.db!, { apply, backupDirectory });
const request = (body: unknown, method = "POST") =>
  new NextRequest("http://localhost/api/test", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
const session = (user: any) => ({
  user: {
    id: String(user._id),
    role: user.role,
    officeRef: user.officeRef ? String(user.officeRef) : null,
  },
});
const snapshot = async (names: string[]) =>
  Object.fromEntries(
    await Promise.all(
      names.map(async (name) => [
        name,
        JSON.stringify(
          await mongoose.connection.db!.collection(name).find().sort({ _id: 1 }).toArray(),
        ),
      ]),
    ),
  );

describe("non-destructive complaint category catalog", () => {
  it("previews without writes and repeatedly provisions the catalog with original recovered IDs and OSAS-only routing", async () => {
    const osas = await createTestOffice({ code: "OSAS" });
    expect((await migrate(false)).created).toBe(16);
    expect(await Category.countDocuments()).toBe(0);
    const first = await migrate();
    expect(first.created).toBe(16);
    expect(first.backupFile).toBeTruthy();
    expect(await Category.countDocuments({ isActive: true })).toBe(16);
    expect(
      await Category.countDocuments({
        name: { $in: OSAS_CATEGORIES.map((c) => c.name) },
        group: "osas",
      }),
    ).toBe(10);
    expect(await RoutingRule.countDocuments({ targetOfficeRef: osas._id, isActive: true })).toBe(
      16,
    );
    expect(
      await SLARule.countDocuments({
        responseHours: 72,
        resolutionHours: 72,
        escalateToOfficeRef: null,
      }),
    ).toBe(16);
    for (const definition of [...RESTORED_VPAA_CATEGORIES, ...RESTORED_VPAF_CATEGORIES]) {
      const category = await Category.findOne({ name: definition.name });
      expect(String(category!._id)).toBe(definition.historicalId);
      expect(category!.description).toBe(definition.description);
      expect(category!.defaultPriority).toBe(definition.defaultPriority);
      expect(String((await SLARule.findOne({ categoryRef: category!._id }))!._id)).toBe(
        definition.historicalSlaId,
      );
    }
    const before = await snapshot(["categories", "routing_rules", "sla_rules"]);
    expect(await migrate()).toMatchObject({
      created: 0,
      updated: 0,
      routesCreated: 0,
      routesUpdated: 0,
      slaCreated: 0,
    });
    expect(await snapshot(["categories", "routing_rules", "sla_rules"])).toEqual(before);
    expect(await Complaint.countDocuments()).toBe(0);
  });

  it("renames known aliases in place, preserves disabled categories and custom SLA settings, and leaves all unrelated records unchanged", async () => {
    const osas = await createTestOffice({ code: "OSAS" });
    const inactive = await createTestCategory({
      name: "Health & Medical Services",
      defaultOfficeRef: osas._id,
      defaultPriority: "critical",
      isActive: false,
    });
    const scholarship = await createTestCategory({
      name: "Scholarships & Financial Assistance",
      defaultOfficeRef: osas._id,
      defaultPriority: "high",
    });
    const customRule = await createTestSlaRule(String(scholarship._id), {
      priority: "high",
      responseHours: 12,
      resolutionHours: 60,
    });
    const disabledRule = await createTestSlaRule(String(inactive._id), {
      priority: "critical",
      responseHours: 4,
      resolutionHours: 16,
      isActive: false,
    });
    const db = mongoose.connection.db!;
    const protectedCollections = [
      "complaints",
      "complaint_timeline",
      "assignments",
      "forwarding_requests",
      "audit_logs",
      "users",
      "notifications",
      "offices",
    ];
    for (const name of protectedCollections.filter((name) => name !== "offices"))
      await db.collection(name).insertOne({
        categoryRef: inactive._id,
        marker: "keep unchanged",
        createdAt: new Date("2026-01-01"),
      });
    const before = await snapshot(protectedCollections);
    const result = await migrate();
    expect(result.inactivePreserved).toContain("Medical and Dental Services");
    const saved = await Category.findById(inactive._id);
    expect(saved).toMatchObject({
      name: "Medical and Dental Services",
      defaultPriority: "critical",
      isActive: false,
      group: "osas",
    });
    expect(
      String((await Category.findOne({ name: "Scholarships and Financial Assistance" }))!._id),
    ).toBe(String(scholarship._id));
    expect((await SLARule.findById(customRule._id))!.toObject()).toEqual(customRule.toObject());
    expect((await SLARule.findById(disabledRule._id))!.toObject()).toEqual(disabledRule.toObject());
    expect(await RoutingRule.countDocuments({ categoryRef: inactive._id })).toBe(0);
    expect(await snapshot(protectedCollections)).toEqual(before);
    expect(
      await Category.countDocuments({ name: /Health & Medical|Scholarships & Financial/ }),
    ).toBe(0);
  });

  it("aborts ambiguous alias identities and historical ID collisions before any writes", async () => {
    const osas = await createTestOffice({ code: "OSAS" });
    await createTestCategory({ name: "Medical and Dental Services", defaultOfficeRef: osas._id });
    const alias = await createTestCategory({
      name: "Health & Medical Services",
      defaultOfficeRef: osas._id,
    });
    const before = await snapshot(["categories", "routing_rules", "sla_rules"]);
    await expect(migrate()).rejects.toThrow("Multiple category records");
    expect(await snapshot(["categories", "routing_rules", "sla_rules"])).toEqual(before);
    await Category.deleteOne({ _id: alias._id });
    await mongoose.connection.db!.collection("categories").insertOne({
      _id: new mongoose.Types.ObjectId(RESTORED_VPAA_CATEGORIES[0].historicalId),
      name: "Custom renamed category",
      defaultPriority: "medium",
      isActive: false,
    });
    const collision = await snapshot(["categories", "routing_rules", "sla_rules"]);
    await expect(migrate()).rejects.toThrow("Historical ID");
    expect(await snapshot(["categories", "routing_rules", "sla_rules"])).toEqual(collision);
  });

  it("retains explicitly disabled SLA and routing rules rather than replacing or reactivating them", async () => {
    const osas = await createTestOffice({ code: "OSAS" });
    const category = await createTestCategory({
      name: "Guidance and Counseling Services",
      defaultOfficeRef: osas._id,
    });
    await createTestSlaRule(String(category._id), { isActive: false, responseHours: 11 });
    await RoutingRule.create({
      categoryRef: category._id,
      targetOfficeRef: osas._id,
      isActive: false,
    });
    const result = await migrate();
    expect(result.warnings).toHaveLength(2);
    expect(await SLARule.countDocuments({ categoryRef: category._id })).toBe(1);
    expect(await SLARule.countDocuments({ categoryRef: category._id, isActive: true })).toBe(0);
    expect(await RoutingRule.countDocuments({ categoryRef: category._id, isActive: true })).toBe(0);
  });

  it("lists all active categories without internal office groups and routes restored-category submissions to OSAS using configured priority and SLA", async () => {
    const osas = await createTestOffice({ code: "OSAS" });
    const aaOffice = await createTestOffice({ code: "OVPAA" });
    const afOffice = await createTestOffice({ code: "OVPAF" });
    const student = await createTestUser();
    const vpaa = await createTestUser({ role: "vpaa", officeRef: aaOffice._id });
    const vpaf = await createTestUser({ role: "vpaf", officeRef: afOffice._id });
    await migrate();
    const hidden = await Category.findOne({ name: OSAS_CATEGORIES[0].name });
    await Category.updateOne({ _id: hidden!._id }, { isActive: false });
    mocks.auth.mockResolvedValue(session(student));
    const list = await (await studentCategories()).json();
    expect(list.categories).toHaveLength(CATEGORY_CATALOG.length - 1);
    for (const category of list.categories) {
      expect(category).not.toHaveProperty("group");
      expect(category).not.toHaveProperty("defaultOfficeRef");
      expect(category).not.toHaveProperty("targetOfficeRef");
    }
    expect(list.categories.find((c: any) => c.name === hidden!.name)).toBeUndefined();
    for (const definition of [...RESTORED_VPAA_CATEGORIES, ...RESTORED_VPAF_CATEGORIES]) {
      const category = (await Category.findOne({ name: definition.name }))!;
      await SLARule.updateOne(
        { categoryRef: category._id },
        { responseHours: 13, resolutionHours: 55 },
      );
      const response = await submitComplaint(
        request({
          categoryRef: String(category._id),
          title: `Concern about ${category.name}`,
          description: "Please review this concern and provide an appropriate response.",
          defaultOfficeRef: String(aaOffice._id),
          group: "vpaa",
        }),
      );
      expect(response.status).toBe(201);
      const saved = (await response.json()).complaint;
      expect(saved.assignedOfficeRef).toBe(String(osas._id));
      expect(saved.initialOfficeRef).toBe(String(osas._id));
      expect(saved.priority).toBe(category.defaultPriority);
      expect(saved.slaPolicy).toMatchObject({ responseHours: 13, resolutionHours: 55 });
      expect(await canAccessComplaint(session(vpaa), saved)).toBe(false);
      expect(await canAccessComplaint(session(vpaf), saved)).toBe(false);
    }
  });

  it("supports category group management without granting receiving-office access or accepting invalid groups", async () => {
    const osas = await createTestOffice({ code: "OSAS" });
    const receiver = await createTestOffice({ code: "OVPAA" });
    const admin = await createTestUser({ role: "administrator" });
    mocks.auth.mockResolvedValue(session(admin));
    const response = await createCategory(
      request({
        name: "Managed academic category",
        description: "Configurable category",
        group: "vpaa",
        defaultOfficeRef: String(receiver._id),
        defaultPriority: "high",
      }),
    );
    expect(response.status).toBe(201);
    const { category } = await response.json();
    expect(category).toMatchObject({
      group: "vpaa",
      isActive: false,
      defaultOfficeRef: String(osas._id),
    });
    const ctx = { params: Promise.resolve({ id: category._id }) };
    expect((await updateCategory(request({ group: "vpaf" }, "PATCH"), ctx)).status).toBe(200);
    expect((await Category.findById(category._id))!.group).toBe("vpaf");
    expect((await updateCategory(request({ group: "all_offices" }, "PATCH"), ctx)).status).toBe(
      400,
    );
    expect((await updateCategory(request({ group: null }, "PATCH"), ctx)).status).toBe(200);
    expect((await Category.findById(category._id))!.group).toBeNull();
    expect((await adminCategories()).status).toBe(200);
    mocks.auth.mockResolvedValue({
      user: { id: String(admin._id), role: "vpaa", officeRef: String(receiver._id) },
    });
    expect((await adminCategories()).status).toBe(403);
    expect(await Office.countDocuments()).toBe(2);
  });
});
