// src/app/api/admin/users/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { requireScopedAdmin } from "@/lib/api-guards";
import { User } from "@/models/User";
import { Office } from "@/models/Office";
import { createUserSchema } from "@/features/admin/schemas/user.schema";
import { hashPassword } from "@/lib/password";
import { writeAuditLog } from "@/features/audit-log/services/audit-log.service";
import { userFilterForScope } from "@/lib/admin-scope";

export async function GET(req: NextRequest) {
  const guard = await requireScopedAdmin();
  if (guard.error) return guard.error;
  const { scope } = guard;

  await connectToDatabase();

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  // Capped well above this institution's realistic headcount rather than
  // paginated — the admin Users page relies on having the full roster in
  // memory for instant client-side search/sort/filter (see src/app/admin/
  // users/page.tsx). 20 was silently hiding most of the user base once
  // seed/real data passed that count.
  const limit = Math.min(2000, Number(searchParams.get("limit") ?? 20));
  const role = searchParams.get("role");

  const filter: Record<string, unknown> = { ...(await userFilterForScope(scope)) };
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
  const guard = await requireScopedAdmin();
  if (guard.error) return guard.error;
  const { scope } = guard;

  await connectToDatabase();

  const body = await req.json();
  const parsed = createUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { password, ...rest } = parsed.data;

  // vpaa/vpaf may only create staff-shaped users in their own office
  // category; osas may only create students; only administrator may
  // create administrator/vpaa/vpaf/osas accounts.
  if (scope.kind === "student") {
    if (rest.role !== "student") {
      return NextResponse.json(
        { error: "You can only create student accounts" },
        { status: 403 },
      );
    }
  } else if (scope.kind === "college_office" || scope.kind === "university_office") {
    if (rest.role !== "office_staff") {
      return NextResponse.json(
        { error: "You can only create staff accounts in your own office category" },
        { status: 403 },
      );
    }
    const targetOffice = rest.officeRef ? await Office.findById(rest.officeRef).select("type").lean() : null;
    if ((targetOffice as any)?.type !== scope.kind) {
      return NextResponse.json(
        { error: "You can only assign staff to an office in your own office category" },
        { status: 403 },
      );
    }
  }

  const existing = await User.findOne({
    $or: [{ email: rest.email }, { employeeOrStudentId: rest.employeeOrStudentId }],
  });
  if (existing) {
    return NextResponse.json(
      { error: "A user with this email or ID already exists" },
      { status: 409 },
    );
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
