// src/features/admin/schemas/user.integration.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { connectTestDb, disconnectTestDb, clearTestDb } from "@/test/setup-db";
import { createUserSchema } from "./user.schema";
import { User } from "@/models/User";
import { createTestCollege, createTestOffice } from "@/test/fixtures";

beforeAll(connectTestDb);
afterAll(disconnectTestDb);
beforeEach(clearTestDb);

describe("User creation — BR-001/003/006-009/011", () => {
  it("BR-008: rejects a student without collegeRef", () => {
    const result = createUserSchema.safeParse({
      employeeOrStudentId: "2026-001",
      firstName: "A",
      lastName: "B",
      email: "a@test.com",
      password: "password1",
      role: "student",
    });
    expect(result.success).toBe(false);
  });

  it("BR-009: rejects office_staff without officeRef", () => {
    const result = createUserSchema.safeParse({
      employeeOrStudentId: "EMP-001",
      firstName: "A",
      lastName: "B",
      email: "a@test.com",
      password: "password1",
      role: "office_staff",
    });
    expect(result.success).toBe(false);
  });

  it("BR-008: accepts a student with collegeRef present", async () => {
    const college = await createTestCollege();
    const result = createUserSchema.safeParse({
      employeeOrStudentId: "2026-002",
      firstName: "A",
      lastName: "B",
      email: "a2@test.com",
      password: "password1",
      role: "student",
      collegeRef: String(college._id),
    });
    expect(result.success).toBe(true);
  });

  it("BR-003/006: rejects duplicate email or student number at the DB level", async () => {
    const college = await createTestCollege();
    await User.create({
      employeeOrStudentId: "2026-003",
      firstName: "A",
      lastName: "B",
      email: "dup@test.com",
      passwordHash: "x",
      role: "student",
      collegeRef: college._id,
    });

    await expect(
      User.create({
        employeeOrStudentId: "2026-003", // duplicate ID
        firstName: "C",
        lastName: "D",
        email: "different@test.com",
        passwordHash: "x",
        role: "student",
        collegeRef: college._id,
      }),
    ).rejects.toThrow();
  });

  it("BR-001: role must be one of the defined enum values", () => {
    const result = createUserSchema.safeParse({
      employeeOrStudentId: "2026-004",
      firstName: "A",
      lastName: "B",
      email: "a4@test.com",
      password: "password1",
      role: "super_admin", // not a real role
    });
    expect(result.success).toBe(false);
  });
});
