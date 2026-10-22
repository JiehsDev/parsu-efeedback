import { beforeAll, afterAll, beforeEach, describe, it, expect } from "vitest";
import { connectTestDb, disconnectTestDb, clearTestDb } from "@/test/setup-db";
import { createTestOffice, createTestUser } from "@/test/fixtures";
import { Office } from "@/models/Office";
import { resolveManualEscalationTarget } from "./manual-escalation";
beforeAll(connectTestDb);
afterAll(disconnectTestDb);
beforeEach(clearTestDb);
describe("internal supervisory escalation", () => {
  it("targets OSAS Head without following the old parent office", async () => {
    const parent = await createTestOffice({ code: "OVPAA" });
    const osas = await createTestOffice({ code: "OSAS", parentOffice: parent._id });
    const head = await createTestUser({ role: "osas", officeRef: osas._id });
    await Office.updateOne({ _id: osas._id }, { $set: { headUserRef: head._id } });
    const c = { assignedOfficeRef: osas._id, assignedStaffRef: null };
    const target = await resolveManualEscalationTarget(c, "office_staff");
    expect(String(target?.office._id)).toBe(String(osas._id));
    expect(String(target?.staff._id)).toBe(String(head._id));
    expect(
      await resolveManualEscalationTarget({ ...c, assignedStaffRef: head._id }, "osas"),
    ).toBeNull();
    expect(await resolveManualEscalationTarget(c, "vpaa")).toBeNull();
    expect(await resolveManualEscalationTarget(c, "vpaf")).toBeNull();
  });
  it("never escalates historical non-OSAS ownership into processing", async () => {
    const legacy = await createTestOffice();
    await createTestOffice({ code: "OSAS" });
    expect(await resolveManualEscalationTarget({ assignedOfficeRef: legacy._id })).toBeNull();
  });
});
