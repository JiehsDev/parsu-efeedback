// src/models/office.integration.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { connectTestDb, disconnectTestDb, clearTestDb } from "@/test/setup-db";
import { Office } from "@/models/Office";
import { User } from "@/models/User";
import { createTestCollege, createTestOffice, createTestUser } from "@/test/fixtures";

beforeAll(connectTestDb);
afterAll(disconnectTestDb);
beforeEach(clearTestDb);

describe("Office model — BR-014/015/019/020", () => {
  it("BR-019: enforces a unique office code across offices and colleges alike", async () => {
    await createTestOffice({ code: "DUP-CODE" });
    await expect(createTestCollege({ code: "DUP-CODE" })).rejects.toThrow();
  });

  it("BR-019: enforces uniqueness case-insensitively (code is stored uppercase)", async () => {
    await Office.create({
      name: "Registrar",
      type: "service_office",
      code: "reg-lower",
      isActive: true,
    });

    await expect(
      Office.create({
        name: "Registrar Duplicate",
        type: "service_office",
        code: "REG-LOWER",
        isActive: true,
      }),
    ).rejects.toThrow();
  });

  it("BR-014/015: a student links to exactly one college via collegeRef, populatable from Office", async () => {
    const college = await createTestCollege({ name: "College of Science" });
    const student = await createTestUser({ role: "student", collegeRef: college._id });

    const found = await User.findById(student._id).populate("collegeRef");
    expect(found).not.toBeNull();
    expect((found!.collegeRef as any).name).toBe("College of Science");
    expect((found!.collegeRef as any).type).toBe("college");
  });

  it("BR-020: isActive defaults to true and can be flipped to mark an office inactive", async () => {
    const office = await createTestOffice();
    expect(office.isActive).toBe(true);

    office.isActive = false;
    await office.save();

    const saved = await Office.findById(office._id).lean();
    expect((saved as any)!.isActive).toBe(false);
  });
});
