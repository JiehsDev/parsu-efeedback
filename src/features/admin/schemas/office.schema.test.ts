// src/features/admin/schemas/office.schema.test.ts
import { describe, it, expect } from "vitest";
import { createOfficeSchema, updateOfficeSchema } from "./office.schema";

describe("office.schema — BR-014/019", () => {
  it("BR-019: requires a non-empty code and uppercases it", () => {
    const result = createOfficeSchema.safeParse({
      name: "Registrar",
      type: "service_office",
      code: "reg-01",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.code).toBe("REG-01");
    }
  });

  it("BR-019: rejects an empty code", () => {
    const result = createOfficeSchema.safeParse({
      name: "Registrar",
      type: "service_office",
      code: "",
    });
    expect(result.success).toBe(false);
  });

  it("BR-014: only accepts a type from the documented office/college enum", () => {
    const result = createOfficeSchema.safeParse({
      name: "Bad Type",
      type: "not_a_real_type",
      code: "BAD-1",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a valid college-type office", () => {
    const result = createOfficeSchema.safeParse({
      name: "College of Engineering",
      type: "college",
      code: "COE",
    });
    expect(result.success).toBe(true);
  });

  it("isActive defaults to true when omitted", () => {
    const result = createOfficeSchema.safeParse({
      name: "Registrar",
      type: "service_office",
      code: "REG-02",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.isActive).toBe(true);
    }
  });

  it("updateOfficeSchema makes every field optional (partial update)", () => {
    const result = updateOfficeSchema.safeParse({ isActive: false });
    expect(result.success).toBe(true);
  });
});
