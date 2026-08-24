// src/app/api/admin/sla-rules/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { requireAdmin } from "@/lib/api-guards";
import { SLARule } from "@/models/SLARule";
import { Category } from "@/models/Category";
import { updateSlaRuleSchema } from "@/features/sla/schemas/sla-rule.schema";
import { writeAuditLog } from "@/features/audit-log/services/audit-log.service";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin();
  if (guard.error) return guard.error;

  await connectToDatabase();
  const { id } = await params;

  const body = await req.json();
  const parsed = updateSlaRuleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const before = await SLARule.findById(id).lean();
  if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const effectiveCategoryRef = parsed.data.categoryRef ?? (before as any).categoryRef;
  const effectivePriority = parsed.data.priority ?? (before as any).priority;

  // Same direction as create: editing a category-scoped rule's priority
  // here cascades onto that category's defaultPriority (see
  // src/app/api/admin/sla-rules/route.ts for the fuller reasoning).
  if (effectiveCategoryRef) {
    const category = await Category.findById(effectiveCategoryRef).lean();
    if (!category) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }
    if (effectivePriority !== (category as any).defaultPriority) {
      await Category.updateOne(
        { _id: effectiveCategoryRef },
        { $set: { defaultPriority: effectivePriority } },
      );
    }
  }

  if (parsed.data.isActive) {
    const conflictFilter = effectiveCategoryRef
      ? { categoryRef: effectiveCategoryRef, isActive: true, _id: { $ne: id } }
      : { categoryRef: null, priority: effectivePriority, isActive: true, _id: { $ne: id } };
    const conflict = await SLARule.findOne(conflictFilter);
    if (conflict) {
      return NextResponse.json(
        {
          error: effectiveCategoryRef
            ? "Another active SLA rule already exists for this category"
            : "Another active institution-wide default already exists for this priority",
        },
        { status: 409 },
      );
    }
  }

  const after = await SLARule.findByIdAndUpdate(id, parsed.data, { returnDocument: "after" }).lean();

  await writeAuditLog({
    actorId: guard.session.user.id,
    action: "sla_rule.update",
    entityType: "SLARule",
    entityId: id,
    beforeState: before,
    afterState: after,
    ipAddress: req.headers.get("x-forwarded-for"),
    userAgent: req.headers.get("user-agent"),
  });

  return NextResponse.json({ rule: after });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin();
  if (guard.error) return guard.error;

  await connectToDatabase();
  const { id } = await params;

  const before = await SLARule.findById(id).lean();
  if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const after = await SLARule.findByIdAndUpdate(id, { isActive: false }, { returnDocument: "after" }).lean();

  await writeAuditLog({
    actorId: guard.session.user.id,
    action: "sla_rule.deactivate",
    entityType: "SLARule",
    entityId: id,
    beforeState: before,
    afterState: after,
    ipAddress: req.headers.get("x-forwarded-for"),
    userAgent: req.headers.get("user-agent"),
  });

  return NextResponse.json({ rule: after });
}
