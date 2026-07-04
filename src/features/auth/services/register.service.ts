// Student self-registration. See the comment above `registerSchema` in
// ../schemas/register.schema.ts for why /register only ever creates
// role: "student" accounts — BR-011 reserves staff/dean/qa/admin account
// creation for administrators (Phase 7, /admin/users).

import { connectToDatabase } from "@/lib/db";
import { Office } from "@/models/Office";
import { User } from "@/models/User";
import type { RegisterInput } from "../schemas/register.schema";
import { hashPassword } from "./password.service";

export class EmailAlreadyRegisteredError extends Error {
  constructor() {
    super("An account with this email already exists.");
    this.name = "EmailAlreadyRegisteredError";
  }
}

export class StudentNumberAlreadyRegisteredError extends Error {
  constructor() {
    super("An account with this student number already exists.");
    this.name = "StudentNumberAlreadyRegisteredError";
  }
}

export class InvalidCollegeError extends Error {
  constructor() {
    super("Select a valid college.");
    this.name = "InvalidCollegeError";
  }
}

export async function registerStudent(input: RegisterInput): Promise<{ id: string }> {
  await connectToDatabase();

  // BR-008: student belongs to exactly one college — must exist and
  // actually be a college (not a service office).
  const college = await Office.findOne({ _id: input.collegeId, type: "college" });
  if (!college) {
    throw new InvalidCollegeError();
  }

  // BR-003 / BR-006: uniqueness pre-checks. The schema's unique indexes are
  // the real guarantee under race conditions; these checks just produce a
  // friendlier field-specific error in the common case.
  const [existingEmail, existingStudentNumber] = await Promise.all([
    User.findOne({ email: input.email }),
    User.findOne({ employeeOrStudentId: input.studentNumber }),
  ]);
  if (existingEmail) throw new EmailAlreadyRegisteredError();
  if (existingStudentNumber) throw new StudentNumberAlreadyRegisteredError();

  const passwordHash = await hashPassword(input.password);

  try {
    const user = await User.create({
      employeeOrStudentId: input.studentNumber,
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      passwordHash,
      role: "student",
      collegeRef: college._id,
      isActive: true,
    });

    return { id: user._id.toString() };
  } catch (error) {
    // Duplicate key race lost between the pre-check and the insert.
    if (isDuplicateKeyError(error)) {
      throw new EmailAlreadyRegisteredError();
    }
    throw error;
  }
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: number }).code === 11000
  );
}
