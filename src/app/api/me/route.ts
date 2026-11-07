// src/app/api/me/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db";
import { auth } from "@/lib/auth";
import { User } from "@/models/User";
import "@/models/Office"; // ← needed even though unused directly, so its schema registers before .populate() runs
import { hashPassword, verifyPassword } from "@/lib/password";
import { passwordSchema } from "@/features/auth/schemas/register.schema";
import { getPendingEmailChange } from "@/features/auth/services/email-change.service";
import { checkRateLimit, getRequestIp, profileSecurityRateLimit } from "@/lib/rate-limit";

const updateProfileSchema = z.object({
  firstName: z.string().trim().min(1).optional(),
  lastName: z.string().trim().min(1).optional(),
  currentPassword: z.string().max(72).optional(),
  newPassword: passwordSchema.optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectToDatabase();

  const [user, pendingEmailChange] = await Promise.all([
    User.findById(session.user.id)
      .select("firstName lastName email employeeOrStudentId role officeRef collegeRef")
      .populate("officeRef", "name")
      .populate("collegeRef", "name")
      .lean(),
    getPendingEmailChange(session.user.id),
  ]);

  return NextResponse.json({
    user,
    pendingEmailChange: pendingEmailChange
      ? { email: pendingEmailChange.newEmail, expiresAt: pendingEmailChange.expiresAt }
      : null,
  });
}

// Deliberately narrow: a user may only ever change their own name/password
// here. Role, officeRef, collegeRef, isActive are all admin-only fields
// (BR-011) and are never touched by this route, regardless of what a
// request body contains — this endpoint doesn't even read those fields.
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectToDatabase();

  const body = await req.json();
  const parsed = updateProfileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        errors: parsed.error.issues,
      },
      { status: 400 },
    );
  }

  const { firstName, lastName, currentPassword, newPassword } = parsed.data;

  const user = await User.findById(session.user.id);
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (firstName) user.firstName = firstName;
  if (lastName) user.lastName = lastName;

  if (newPassword) {
    const { success } = await checkRateLimit(
      profileSecurityRateLimit,
      `${session.user.id}:${getRequestIp(req.headers)}`,
    );
    if (!success) {
      return NextResponse.json(
        { error: "Too many security changes. Try again later." },
        { status: 429 },
      );
    }
    if (!currentPassword) {
      return NextResponse.json(
        { error: "Current password is required to set a new password" },
        { status: 400 },
      );
    }
    const valid = await verifyPassword(currentPassword, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
    }
    user.passwordHash = await hashPassword(newPassword);
    user.passwordChangedAt = new Date();
    user.tokenVersion += 1; // force existing sessions to re-authenticate
  }

  await user.save();

  const safeUser = {
    _id: user._id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    employeeOrStudentId: user.employeeOrStudentId,
    role: user.role,
    officeRef: user.officeRef,
    collegeRef: user.collegeRef,
  };
  return NextResponse.json({ user: safeUser });
}
