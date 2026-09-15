// src/app/api/admin/offices/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { requireScopedAdmin } from "@/lib/api-guards";
import { Office } from "@/models/Office";
import { User } from "@/models/User";
import { updateOfficeSchema } from "@/features/admin/schemas/office.schema";
import { writeAuditLog } from "@/features/audit-log/services/audit-log.service";
import {
  assignOfficeHead,
  removeOfficeHead,
} from "@/features/admin/services/office-head.service";

function outOfScope(scope: { kind: string }, office: { type: string } | null): boolean {
  if (!office) return false;
  return (
    (scope.kind === "college_office" || scope.kind === "university_office") &&
    office.type !== scope.kind
  );
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireScopedAdmin();
  if (guard.error) return guard.error;
  const { scope } = guard;
  if (scope.kind === "student") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await connectToDatabase();
  const { id } = await params;
  const office = await Office.findById(id).lean();
  if (!office) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (outOfScope(scope, office as any)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ office });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireScopedAdmin();
  if (guard.error) return guard.error;
  const { scope } = guard;
  if (scope.kind === "student") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await connectToDatabase();
  const { id } = await params;

  const body = await req.json();
  const parsed = updateOfficeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const before = await Office.findById(id).lean();
  if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (outOfScope(scope, before as any)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  // vpaa/vpaf may not move an office out of their own category.
  if (
    (scope.kind === "college_office" || scope.kind === "university_office") &&
    parsed.data.type !== undefined &&
    parsed.data.type !== scope.kind
  ) {
    return NextResponse.json(
      { error: "You can only manage offices in your own office category" },
      { status: 403 },
    );
  }

  // Prevent an office from being its own ancestor
  if (parsed.data.parentOffice === id) {
    return NextResponse.json(
      { error: "An office cannot be its own parent" },
      { status: 400 },
    );
  }

  if ("headUserRef" in parsed.data) {
    if (guard.session.user.role !== "administrator") {
      return NextResponse.json({ error: "Only administrators can manage office heads" }, { status: 403 });
    }
    const { headUserRef, ...officeUpdate } = parsed.data;
    const afterBase =
      Object.keys(officeUpdate).length > 0
        ? await Office.findByIdAndUpdate(id, officeUpdate, { returnDocument: "after" }).lean()
        : before;

    const headResult = headUserRef
      ? await assignOfficeHead({
          officeId: id,
          userId: headUserRef,
          actorId: guard.session.user.id,
          ipAddress: req.headers.get("x-forwarded-for"),
          userAgent: req.headers.get("user-agent"),
        })
      : await removeOfficeHead({
          officeId: id,
          actorId: guard.session.user.id,
          ipAddress: req.headers.get("x-forwarded-for"),
          userAgent: req.headers.get("user-agent"),
        });

    if ("error" in headResult) {
      return NextResponse.json({ error: headResult.error }, { status: headResult.status });
    }

    const after = headResult.office ?? afterBase;
    await writeAuditLog({
      actorId: guard.session.user.id,
      action: "office.update",
      entityType: "Office",
      entityId: id,
      beforeState: before,
      afterState: after,
      ipAddress: req.headers.get("x-forwarded-for"),
      userAgent: req.headers.get("user-agent"),
    });

    return NextResponse.json({ office: after });
  }

  const after = await Office.findByIdAndUpdate(id, parsed.data, { returnDocument: "after" }).lean();

  await writeAuditLog({
    actorId: guard.session.user.id,
    action: "office.update",
    entityType: "Office",
    entityId: id,
    beforeState: before,
    afterState: after,
    ipAddress: req.headers.get("x-forwarded-for"),
    userAgent: req.headers.get("user-agent"),
  });

  return NextResponse.json({ office: after });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireScopedAdmin();
  if (guard.error) return guard.error;
  const { scope } = guard;
  if (scope.kind === "student") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await connectToDatabase();
  const { id } = await params;

  const before = await Office.findById(id).lean();
  if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (outOfScope(scope, before as any)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Block deletion if any user still references this office — orphaning
  // officeRef/collegeRef would break RBAC scoping (architecture.md §6)
  const inUse = await User.exists({ $or: [{ officeRef: id }, { collegeRef: id }] });
  if (inUse) {
    return NextResponse.json(
      { error: "Cannot delete: office is still assigned to one or more users" },
      { status: 409 },
    );
  }

  // Soft-delete, consistent with Users — per BR-020 inactive offices just
  // stop receiving new assignments rather than disappearing from history
  const after = await Office.findByIdAndUpdate(id, { isActive: false }, { returnDocument: "after" }).lean();

  await writeAuditLog({
    actorId: guard.session.user.id,
    action: "office.deactivate",
    entityType: "Office",
    entityId: id,
    beforeState: before,
    afterState: after,
    ipAddress: req.headers.get("x-forwarded-for"),
    userAgent: req.headers.get("user-agent"),
  });

  return NextResponse.json({ office: after });
}
