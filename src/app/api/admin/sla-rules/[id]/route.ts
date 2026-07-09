// src/app/api/admin/sla-rules/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { requireAdmin } from "@/lib/api-guards";
import { SLARule } from "@/models/SLARule";
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

  if (parsed.data.isActive) {
    const conflict = await SLARule.findOne({
      categoryRef: parsed.data.categoryRef ?? (before as any).categoryRef,
      priority: parsed.data.priority ?? (before as any).priority,
      isActive: true,
      _id: { $ne: id },
    });
    if (conflict) {
      return NextResponse.json(
        { error: "Another active SLA rule already exists for this category+priority" },
        { status: 409 },
      );
    }
  }

  const after = await SLARule.findByIdAndUpdate(id, parsed.data, { new: true }).lean();

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

  const after = await SLARule.findByIdAndUpdate(id, { isActive: false }, { new: true }).lean();

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
