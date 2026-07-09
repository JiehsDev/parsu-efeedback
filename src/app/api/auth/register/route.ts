// src/app/api/auth/register/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { User } from "@/models/User";
import { Office } from "@/models/Office";
import { registerSchema } from "@/features/auth/schemas/register.schema";
import { hashPassword } from "@/lib/password";

export async function POST(req: NextRequest) {
  await connectToDatabase();

  const body = await req.json();
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { confirmPassword, password, studentNumber, collegeId, ...rest } = parsed.data;

  const college = await Office.findOne({
    _id: collegeId,
    type: "college",
    isActive: true,
  }).lean();
  if (!college) {
    return NextResponse.json({ error: "Invalid college selected" }, { status: 400 });
  }

  const existing = await User.findOne({
    $or: [{ email: rest.email }, { employeeOrStudentId: studentNumber }],
  });
  if (existing) {
    return NextResponse.json(
      { error: "An account with this email or student number already exists" },
      { status: 409 },
    );
  }

  const passwordHash = await hashPassword(password);

  const user = await User.create({
    ...rest,
    employeeOrStudentId: studentNumber,
    collegeRef: collegeId,
    passwordHash,
    role: "student",
    isActive: true,
  });

  const { passwordHash: _omit, ...safeUser } = user.toObject();
  return NextResponse.json({ user: safeUser }, { status: 201 });
}
