// src/app/api/admin/routing-rules/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { requireAdmin } from "@/lib/api-guards";
import { RoutingRule } from "@/models/RoutingRule";
import { Category } from "@/models/Category";
import { createRoutingRuleSchema } from "@/features/routing-engine/schemas/routing-rule.schema";
import { writeAuditLog } from "@/features/audit-log/services/audit-log.service";

export async function GET(req: NextRequest) {
  const guard = await requireAdmin();
  if (guard.error) return guard.error;

  await connectToDatabase();
  const rules = await RoutingRule.find().sort({ categoryRef: 1, priority: 1 }).lean();
  return NextResponse.json({ rules });
}

export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if (guard.error) return guard.error;

  await connectToDatabase();

  const body = await req.json();
  const parsed = createRoutingRuleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // BR-023 backstop: catch the partial-unique-index violation early with
  // a friendly message instead of a raw Mongo duplicate-key error
  if (parsed.data.isActive) {
    const existingActive = await RoutingRule.findOne({
      categoryRef: parsed.data.categoryRef,
      isActive: true,
    });
    if (existingActive) {
      return NextResponse.json(
        { error: "This category already has an active routing rule. Deactivate it first." },
        { status: 409 },
      );
    }
  }

  const rule = await RoutingRule.create(parsed.data);

  // The category's own defaultOfficeRef is just a denormalized mirror of
  // its active routing rule's target — keep it in sync here rather than
  // asking for the office twice (see src/models/Category.ts).
  await Category.updateOne(
    { _id: parsed.data.categoryRef },
    { $set: { defaultOfficeRef: parsed.data.targetOfficeRef } },
  );

  await writeAuditLog({
    actorId: guard.session.user.id,
    action: "routing_rule.create",
    entityType: "RoutingRule",
    entityId: rule._id,
    afterState: rule.toObject(),
    ipAddress: req.headers.get("x-forwarded-for"),
    userAgent: req.headers.get("user-agent"),
  });

  return NextResponse.json({ rule }, { status: 201 });
}
