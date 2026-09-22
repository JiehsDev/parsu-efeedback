import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { connectTestDb, disconnectTestDb, clearTestDb } from "@/test/setup-db";
import { createTestOffice, createTestCollege } from "@/test/fixtures";
import { getEligibleReassignmentOffices } from "./office-reassignment-scope";

beforeAll(connectTestDb);
afterAll(disconnectTestDb);
beforeEach(clearTestDb);

function ids(offices: any[]) {
  return offices.map((o) => String(o._id)).sort();
}

describe("getEligibleReassignmentOffices", () => {
  it("Registrar (university office) may reassign to any active college", async () => {
    const registrar = await createTestOffice({ name: "Registrar", code: "OUR" });
    const cecs = await createTestCollege({ name: "CECS" });
    const cos = await createTestCollege({ name: "COS" });

    const eligible = await getEligibleReassignmentOffices(registrar);

    expect(ids(eligible)).toEqual(ids([cecs, cos]));
  });

  it("a college may reassign laterally to another college sharing the same parent, but not to a college under a different parent", async () => {
    const ovpaa = await createTestOffice({ name: "OVPAA", code: "OVPAA" });
    const otherParent = await createTestOffice({ name: "Other Parent", code: "OTHERP" });
    const cecs = await createTestCollege({ name: "CECS", parentOffice: ovpaa._id });
    const ced = await createTestCollege({ name: "CED", parentOffice: ovpaa._id });
    const unrelatedCollege = await createTestCollege({ name: "Unrelated", parentOffice: otherParent._id });

    const eligible = await getEligibleReassignmentOffices(cecs);

    expect(ids(eligible)).toEqual([String(ced._id)]);
    expect(ids(eligible)).not.toContain(String(unrelatedCollege._id));
  });

  it("a university office may reassign to a sibling university office sharing the same parent, but not to its own parent", async () => {
    const ovpaf = await createTestOffice({ name: "OVPAF", code: "OVPAF" });
    const registrar = await createTestOffice({ name: "Registrar", code: "OUR", parentOffice: ovpaf._id });
    const gso = await createTestOffice({ name: "GSO", code: "GSO", parentOffice: ovpaf._id });

    const eligible = await getEligibleReassignmentOffices(registrar);

    const eligibleIds = ids(eligible);
    expect(eligibleIds).toContain(String(gso._id));
    expect(eligibleIds).not.toContain(String(ovpaf._id));
  });

  it("excludes the current office itself and inactive offices", async () => {
    const ovpaa = await createTestOffice({ name: "OVPAA", code: "OVPAA" });
    const registrar = await createTestOffice({ name: "Registrar", code: "OUR" });
    const activeCollege = await createTestCollege({ name: "Active College" });
    const inactiveCollege = await createTestCollege({ name: "Inactive College", isActive: false });

    const eligible = await getEligibleReassignmentOffices(registrar);

    expect(ids(eligible)).toEqual([String(activeCollege._id)]);
    void ovpaa;
    void inactiveCollege;
  });

  it("a university office cannot reassign down to its own child college (not lateral) and has no siblings, so the list is empty", async () => {
    const ovpaa = await createTestOffice({ name: "OVPAA", code: "OVPAA" });
    await createTestCollege({ name: "CECS", parentOffice: ovpaa._id });

    const eligible = await getEligibleReassignmentOffices(ovpaa);

    expect(eligible).toEqual([]);
  });
});
