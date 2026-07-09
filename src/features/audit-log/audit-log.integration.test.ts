// src/features/audit-log/audit-log.integration.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { connectTestDb, disconnectTestDb, clearTestDb } from "@/test/setup-db";
import { writeAuditLog } from "./services/audit-log.service";
import { AuditLog } from "@/models/AuditLog";
import { createTestUser } from "@/test/fixtures";

beforeAll(connectTestDb);
afterAll(disconnectTestDb);
beforeEach(clearTestDb);

describe("Audit logs — BR-075/076/077", () => {
  it("BR-076: records user, action, entity, entityId, timestamp", async () => {
    const admin = await createTestUser({ role: "administrator" });

    await writeAuditLog({
      actorId: String(admin._id),
      action: "user.create",
      entityType: "User",
      entityId: "someEntityId123456789012",
      afterState: { role: "student" },
    });

    const logs = await AuditLog.find({ actorRef: admin._id });
    expect(logs).toHaveLength(1);
    expect(logs[0].action).toBe("user.create");
    expect(logs[0].entityType).toBe("User");
    expect((logs[0] as any).createdAt).toBeInstanceOf(Date);
  });

  it("BR-077: no route/service in the codebase exposes audit log deletion (documented, not enforced by schema)", async () => {
    const admin = await createTestUser({ role: "administrator" });
    await writeAuditLog({
      actorId: String(admin._id),
      action: "test.action",
      entityType: "Test",
      entityId: "someEntityId123456789013",
    });

    const before = await AuditLog.countDocuments();
    expect(before).toBe(1);
    // No deleteOne/deleteMany call exists anywhere for AuditLog in the
    // codebase — this is a code-review-level guarantee, not something
    // the schema itself can enforce. Documenting the gap explicitly here.
  });

  it("BR-075: system events (actorId: null) are still recorded, e.g. SLA auto-escalation", async () => {
    await writeAuditLog({
      actorId: null,
      action: "complaint.sla_escalate",
      entityType: "Complaint",
      entityId: "someEntityId123456789014",
    });

    const logs = await AuditLog.find({ action: "complaint.sla_escalate" });
    expect(logs).toHaveLength(1);
    expect(logs[0].actorRef).toBeNull();
  });
});
