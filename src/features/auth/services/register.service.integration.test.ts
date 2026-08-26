// src/features/auth/services/register.service.integration.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { connectTestDb, disconnectTestDb, clearTestDb } from "@/test/setup-db";
import { createTestUser, createTestCollege, createTestOffice } from "@/test/fixtures";
import { User } from "@/models/User";
import {
  registerStudent,
  EmailAlreadyRegisteredError,
  StudentNumberAlreadyRegisteredError,
  InvalidCollegeError,
} from "./register.service";
import { registerSchema } from "../schemas/register.schema";

beforeAll(connectTestDb);
afterAll(disconnectTestDb);
beforeEach(clearTestDb);

function baseInput(overrides: Partial<any> = {}) {
  return {
    firstName: "New",
    lastName: "Student",
    email: `new-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@test.com`,
    studentNumber: `SN-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    collegeId: "",
    password: "TestPass123!",
    ...overrides,
  };
}

describe("registerStudent — BR-003/006/008/011", () => {
  it("BR-008: rejects a collegeId that does not exist", async () => {
    const { Types } = await import("mongoose");
    await expect(
      registerStudent(baseInput({ collegeId: String(new Types.ObjectId()) }) as any),
    ).rejects.toThrow(InvalidCollegeError);
  });

  it("BR-008: rejects a collegeId that points to a service office, not a college", async () => {
    const office = await createTestOffice();
    await expect(
      registerStudent(baseInput({ collegeId: String(office._id) }) as any),
    ).rejects.toThrow(InvalidCollegeError);
  });

  it("BR-003: rejects a duplicate email", async () => {
    const college = await createTestCollege();
    const existing = await createTestUser({ email: "dup@test.com", role: "student" });

    await expect(
      registerStudent(
        baseInput({ email: existing.email, collegeId: String(college._id) }) as any,
      ),
    ).rejects.toThrow(EmailAlreadyRegisteredError);
  });

  it("BR-006: rejects a duplicate student number", async () => {
    const college = await createTestCollege();
    const existing = await createTestUser({
      employeeOrStudentId: "SN-DUP-1",
      role: "student",
    });

    await expect(
      registerStudent(
        baseInput({
          studentNumber: existing.employeeOrStudentId,
          collegeId: String(college._id),
        }) as any,
      ),
    ).rejects.toThrow(StudentNumberAlreadyRegisteredError);
  });

  it("BR-011: created accounts are always role 'student', regardless of input", async () => {
    const college = await createTestCollege();
    const input: any = baseInput({ collegeId: String(college._id) });
    input.role = "administrator"; // not part of the schema/service input shape

    const { id } = await registerStudent(input);
    const saved = await User.findById(id);
    expect(saved!.role).toBe("student");
  });

  it("BR-008/015: a successful registration links the student to the given college", async () => {
    const college = await createTestCollege();
    const { id } = await registerStudent(baseInput({ collegeId: String(college._id) }) as any);

    const saved = await User.findById(id);
    expect(String(saved!.collegeRef)).toBe(String(college._id));
  });
});

describe("registerSchema — BR-011 (no role field accepted)", () => {
  it("has no 'role' key in its shape, so a role cannot be smuggled through registration input", () => {
    expect("role" in registerSchema.shape).toBe(false);
  });

  it("rejects mismatched password/confirmPassword", () => {
    const result = registerSchema.safeParse({
      firstName: "A",
      lastName: "B",
      email: "a@test.com",
      studentNumber: "SN-1",
      collegeId: "college-id",
      password: "TestPass123!",
      confirmPassword: "Different123!",
    });
    expect(result.success).toBe(false);
  });
});
