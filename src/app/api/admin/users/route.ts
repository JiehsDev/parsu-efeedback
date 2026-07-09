// src/app/api/admin/users/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { requireAdmin } from "@/lib/api-guards";
import { User } from "@/models/User";
import { createUserSchema } from "@/features/admin/schemas/user.schema";
import { hashPassword } from "@/lib/password";
import { writeAuditLog } from "@/features/audit-log/services/audit-log.service";

export async function GET(req: NextRequest) {
  const guard = await requireAdmin();
  if (guard.error) return guard.error;

  await connectToDatabase();

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const limit = Math.min(100, Number(searchParams.get("limit") ?? 20));
  const role = searchParams.get("role");

  const filter: Record<string, unknown> = {};
  if (role) filter.role = role;

  const [users, total] = await Promise.all([
    User.find(filter)
      .select("-passwordHash")
      .populate("officeRef", "name code")
      .populate("collegeRef", "name code")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    User.countDocuments(filter),
  ]);

  return NextResponse.json({ users, total, page, limit });
}

export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if (guard.error) return guard.error;

  await connectToDatabase();

  const body = await req.json();
  const parsed = createUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { password, ...rest } = parsed.data;

  const existing = await User.findOne({
    $or: [{ email: rest.email }, { employeeOrStudentId: rest.employeeOrStudentId }],
  });
  if (existing) {
    return NextResponse.json(
      { error: "A user with this email or ID already exists" },
      { status: 409 },
    );
  }

  // One active dean per college — a college can't have two people both
  // claiming to be its dean at the same time.
  if (rest.role === "college_dean") {
    const existingDean = await User.findOne({
      role: "college_dean",
      collegeRef: rest.collegeRef,
      isActive: true,
    }).lean();
    if (existingDean) {
      return NextResponse.json(
        {
          error:
            "This college already has an active dean. Deactivate the existing dean first, or choose a different college.",
        },
        { status: 409 },
      );
    }
  }

  const passwordHash = await hashPassword(password);
  const user = await User.create({ ...rest, passwordHash });

  await writeAuditLog({
    actorId: guard.session.user.id,
    action: "user.create",
    entityType: "User",
    entityId: user._id,
    afterState: { ...rest, id: user._id },
    ipAddress: req.headers.get("x-forwarded-for"),
    userAgent: req.headers.get("user-agent"),
  });

  const { passwordHash: _omit, ...safeUser } = user.toObject();
  return NextResponse.json({ user: safeUser }, { status: 201 });
}
