// src/app/api/admin/routing-rules/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { requireAdmin } from "@/lib/api-guards";
import { RoutingRule } from "@/models/RoutingRule";
import { updateRoutingRuleSchema } from "@/features/routing-engine/schemas/routing-rule.schema";
import { writeAuditLog } from "@/features/audit-log/services/audit-log.service";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin();
  if (guard.error) return guard.error;

  await connectToDatabase();
  const { id } = await params;

  const body = await req.json();
  const parsed = updateRoutingRuleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const before = await RoutingRule.findById(id).lean();
  if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (parsed.data.isActive) {
    const conflict = await RoutingRule.findOne({
      categoryRef: parsed.data.categoryRef ?? (before as any).categoryRef,
      isActive: true,
      _id: { $ne: id },
    });
    if (conflict) {
      return NextResponse.json(
        { error: "Another active rule already exists for this category" },
        { status: 409 },
      );
    }
  }

  const after = await RoutingRule.findByIdAndUpdate(id, parsed.data, { returnDocument: "after" }).lean();

  await writeAuditLog({
    actorId: guard.session.user.id,
    action: "routing_rule.update",
    entityType: "RoutingRule",
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

  const before = await RoutingRule.findById(id).lean();
  if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const after = await RoutingRule.findByIdAndUpdate(id, { isActive: false }, { returnDocument: "after" }).lean();

  await writeAuditLog({
    actorId: guard.session.user.id,
    action: "routing_rule.deactivate",
    entityType: "RoutingRule",
    entityId: id,
    beforeState: before,
    afterState: after,
    ipAddress: req.headers.get("x-forwarded-for"),
    userAgent: req.headers.get("user-agent"),
  });

  return NextResponse.json({ rule: after });
}
