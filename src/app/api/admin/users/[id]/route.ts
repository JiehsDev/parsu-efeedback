// src/app/api/admin/users/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { requireScopedAdmin } from "@/lib/api-guards";
import { User } from "@/models/User";
import { Office } from "@/models/Office";
import { updateUserSchema } from "@/features/admin/schemas/user.schema";
import { hashPassword } from "@/lib/password";
import { writeAuditLog } from "@/features/audit-log/services/audit-log.service";
import type { AdminScope } from "@/lib/admin-scope";

const SCOPED_ROLE_OFFICE_CODES = { vpaa: "OVPAA", vpaf: "OVPAF", osas: "OSAS" } as const;

async function validateRoleOffice(role: string, officeRef: unknown) {
  if (!["vpaa", "vpaf", "osas"].includes(role)) return null;
  if (!officeRef) return "A scoped administrator must belong to its corresponding office";
  const office = await Office.findById(officeRef).select("code").lean();
  const expected = SCOPED_ROLE_OFFICE_CODES[role as keyof typeof SCOPED_ROLE_OFFICE_CODES];
  if (!office || (office as any).code !== expected) {
    return `${role.toUpperCase()} must belong to the ${expected} office`;
  }
  return null;
}

// vpaa/vpaf may only touch office_staff users already in their
// own office category; osas may only touch students; administrator is
// unrestricted. Used both to gate access to an existing user and to
// validate the effective role/office a PATCH would produce.
async function isUserInScope(
  scope: AdminScope,
  user: { role: string; officeRef: unknown },
): Promise<boolean> {
  if (scope.kind === "all") return true;
  if (scope.kind === "student") return user.role === "student";
  if (user.role !== "office_staff") return false;
  if (!user.officeRef) return false;
  const office = await Office.findById(user.officeRef).select("type").lean();
  return (office as any)?.type === scope.kind;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireScopedAdmin();
  if (guard.error) return guard.error;
  const { scope } = guard;

  await connectToDatabase();
  const { id } = await params;
  const user = await User.findById(id).select("-passwordHash").lean();
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await isUserInScope(scope, user as any))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ user });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireScopedAdmin();
  if (guard.error) return guard.error;
  const { scope } = guard;

  await connectToDatabase();
  const { id } = await params;

  const body = await req.json();
  const parsed = updateUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const before = await User.findById(id).select("-passwordHash").lean();
  if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await isUserInScope(scope, before as any))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (scope.kind !== "all") {
    const effectiveRole = parsed.data.role ?? (before as any).role;
    const effectiveOfficeRef = parsed.data.officeRef ?? (before as any).officeRef;
    const wouldStayInScope = await isUserInScope(scope, {
      role: effectiveRole,
      officeRef: effectiveOfficeRef,
    });
    if (!wouldStayInScope) {
      return NextResponse.json(
        { error: "This change would move the user outside your scope" },
        { status: 403 },
      );
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

  if (
    after &&
    (((before as any).isActive && (after as any).isActive === false) ||
      String((before as any).officeRef ?? "") !== String((after as any).officeRef ?? "") ||
      (before as any).role !== (after as any).role)
  ) {
    await Office.updateMany({ headUserRef: id }, { $set: { headUserRef: null } });
  }

  const effectiveRole = parsed.data.role ?? (before as any).role;
  const effectiveOfficeRef = parsed.data.officeRef !== undefined
    ? parsed.data.officeRef
    : (before as any).officeRef;
  const roleOfficeError = await validateRoleOffice(effectiveRole, effectiveOfficeRef);
  if (roleOfficeError) return NextResponse.json({ error: roleOfficeError }, { status: 400 });

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
  const guard = await requireScopedAdmin();
  if (guard.error) return guard.error;
  const { scope } = guard;

  await connectToDatabase();
  const { id } = await params;

  // Prevent an admin from deleting their own account mid-session
  if (guard.session.user.id === id) {
    return NextResponse.json({ error: "You cannot delete your own account" }, { status: 400 });
  }

  const before = await User.findById(id).select("-passwordHash").lean();
  if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await isUserInScope(scope, before as any))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Soft-delete preferred: deactivate rather than hard-delete, since Users
  // are referenced everywhere (complaints, notes, audit logs)
  const after = await User.findByIdAndUpdate(id, { isActive: false }, { returnDocument: "after" })
    .select("-passwordHash")
    .lean();

  await Office.updateMany({ headUserRef: id }, { $set: { headUserRef: null } });

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
