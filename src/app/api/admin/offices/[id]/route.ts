// src/app/api/admin/offices/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { requireAdmin } from "@/lib/api-guards";
import { Office } from "@/models/Office";
import { User } from "@/models/User";
import { updateOfficeSchema } from "@/features/admin/schemas/office.schema";
import { writeAuditLog } from "@/features/audit-log/services/audit-log.service";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdmin();
  if (guard.error) return guard.error;

  await connectToDatabase();
  const { id } = await params;
  const office = await Office.findById(id).lean();
  if (!office) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ office });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdmin();
  if (guard.error) return guard.error;

  await connectToDatabase();
  const { id } = await params;

  const body = await req.json();
  const parsed = updateOfficeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const before = await Office.findById(id).lean();
  if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Prevent an office from being its own ancestor
  if (parsed.data.parentOffice === id) {
    return NextResponse.json(
      { error: "An office cannot be its own parent" },
      { status: 400 },
    );
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
  const guard = await requireAdmin();
  if (guard.error) return guard.error;

  await connectToDatabase();
  const { id } = await params;

  const before = await Office.findById(id).lean();
  if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });

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