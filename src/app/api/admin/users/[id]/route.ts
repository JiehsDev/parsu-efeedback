// src/app/api/admin/users/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { requireAdmin } from "@/lib/api-guards";
import { User } from "@/models/User";
import { updateUserSchema } from "@/features/admin/schemas/user.schema";
import { hashPassword } from "@/lib/password";
import { writeAuditLog } from "@/features/audit-log/services/audit-log.service";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin();
  if (guard.error) return guard.error;

  await connectToDatabase();
  const { id } = await params;
  const user = await User.findById(id).select("-passwordHash").lean();
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ user });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin();
  if (guard.error) return guard.error;

  await connectToDatabase();
  const { id } = await params;

  const body = await req.json();
  const parsed = updateUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const before = await User.findById(id).select("-passwordHash").lean();
  if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (
    (parsed.data.role === "college_dean" || (before as any).role === "college_dean") &&
    parsed.data.isActive !== false
  ) {
    const effectiveRole = parsed.data.role ?? (before as any).role;
    const effectiveCollegeRef = parsed.data.collegeRef ?? (before as any).collegeRef;

    if (effectiveRole === "college_dean" && effectiveCollegeRef) {
      const conflict = await User.findOne({
        role: "college_dean",
        collegeRef: effectiveCollegeRef,
        isActive: true,
        _id: { $ne: id },
      }).lean();
      if (conflict) {
        return NextResponse.json(
          { error: "This college already has an active dean." },
          { status: 409 },
        );
      }
    }
  }
  const { password, forceLogout, ...rest } = parsed.data;
  const update: Record<string, unknown> = { ...rest };

  if (password) {
    update.passwordHash = await hashPassword(password);
    update.passwordChangedAt = new Date();
    // Force existing sessions to invalidate on password reset
    update.tokenVersion = (before as any).tokenVersion + 1;
  } else if (forceLogout) {
    update.tokenVersion = (before as any).tokenVersion + 1;
  }

  const after = await User.findByIdAndUpdate(id, update, { returnDocument: "after" })
    .select("-passwordHash")
    .lean();

  const isForceLogoutOnly = forceLogout && !password && Object.keys(rest).length === 0;

  await writeAuditLog({
    actorId: guard.session.user.id,
    action: isForceLogoutOnly ? "user.force_logout" : "user.update",
    entityType: "User",
    entityId: id,
    beforeState: before,
    afterState: after,
    ipAddress: req.headers.get("x-forwarded-for"),
    userAgent: req.headers.get("user-agent"),
  });

  return NextResponse.json({ user: after });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin();
  if (guard.error) return guard.error;

  await connectToDatabase();
  const { id } = await params;

  // Prevent an admin from deleting their own account mid-session
  if (guard.session.user.id === id) {
    return NextResponse.json({ error: "You cannot delete your own account" }, { status: 400 });
  }

  const before = await User.findById(id).select("-passwordHash").lean();
  if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Soft-delete preferred: deactivate rather than hard-delete, since Users
  // are referenced everywhere (complaints, notes, audit logs)
  const after = await User.findByIdAndUpdate(id, { isActive: false }, { returnDocument: "after" })
    .select("-passwordHash")
    .lean();

  await writeAuditLog({
    actorId: guard.session.user.id,
    action: "user.deactivate",
    entityType: "User",
    entityId: id,
    beforeState: before,
    afterState: after,
    ipAddress: req.headers.get("x-forwarded-for"),
    userAgent: req.headers.get("user-agent"),
  });

  return NextResponse.json({ user: after });
}
