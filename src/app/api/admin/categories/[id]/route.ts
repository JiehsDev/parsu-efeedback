// src/app/api/admin/categories/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { requireAdmin } from "@/lib/api-guards";
import { Category } from "@/models/Category";
import { updateCategorySchema } from "@/features/admin/schemas/category.schema";
import { writeAuditLog } from "@/features/audit-log/services/audit-log.service";
import { RoutingRule } from "@/models/RoutingRule";
import { SLARule } from "@/models/SLARule";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin();
  if (guard.error) return guard.error;

  await connectToDatabase();
  const { id } = await params;
  const category = await Category.findById(id).lean();
  if (!category) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ category });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin();
  if (guard.error) return guard.error;

  await connectToDatabase();
  const { id } = await params;

  const body = await req.json();
  const parsed = updateCategorySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const before = await Category.findById(id).lean();
  if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // BR-023: block activating a category with no active routing rule
  if (parsed.data.isActive === true) {
    const activeRule = await RoutingRule.findOne({ categoryRef: id, isActive: true }).lean();
    if (!activeRule) {
      return NextResponse.json(
        { error: "Cannot activate this category: it has no active routing rule yet." },
        { status: 409 },
      );
    }
  }

  const after = await Category.findByIdAndUpdate(id, parsed.data, { returnDocument: "after" }).lean();

  // Keep the category's one guaranteed SLA rule pinned to its (possibly
  // just-changed) defaultPriority — a category-scoped SLA rule's priority
  // is never an independent choice, it always tracks the category's own
  // (see SLARule.ts / the admin/sla-rules routes' validation).
  if (
    parsed.data.defaultPriority &&
    parsed.data.defaultPriority !== (before as any).defaultPriority
  ) {
    await SLARule.updateOne(
      { categoryRef: id, isActive: true },
      { $set: { priority: parsed.data.defaultPriority } },
    );
  }

  await writeAuditLog({
    actorId: guard.session.user.id,
    action: "category.update",
    entityType: "Category",
    entityId: id,
    beforeState: before,
    afterState: after,
    ipAddress: req.headers.get("x-forwarded-for"),
    userAgent: req.headers.get("user-agent"),
  });

  return NextResponse.json({ category: after });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin();
  if (guard.error) return guard.error;

  await connectToDatabase();
  const { id } = await params;

  const before = await Category.findById(id).lean();
  if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Soft-delete — BR-024: inactive categories just stop appearing on the
  // submission form, but historical complaints still reference them
  const after = await Category.findByIdAndUpdate(id, { isActive: false }, { returnDocument: "after" }).lean();

  await writeAuditLog({
    actorId: guard.session.user.id,
    action: "category.deactivate",
    entityType: "Category",
    entityId: id,
    beforeState: before,
    afterState: after,
    ipAddress: req.headers.get("x-forwarded-for"),
    userAgent: req.headers.get("user-agent"),
  });

  return NextResponse.json({ category: after });
}
