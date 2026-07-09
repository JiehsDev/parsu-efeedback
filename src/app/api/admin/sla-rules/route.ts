// src/app/api/admin/sla-rules/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { requireAdmin } from "@/lib/api-guards";
import { SLARule } from "@/models/SLARule";
import { createSlaRuleSchema } from "@/features/sla/schemas/sla-rule.schema";
import { writeAuditLog } from "@/features/audit-log/services/audit-log.service";

export async function GET(req: NextRequest) {
  const guard = await requireAdmin();
  if (guard.error) return guard.error;

  await connectToDatabase();
  const rules = await SLARule.find().sort({ categoryRef: 1, priority: 1 }).lean();
  return NextResponse.json({ rules });
}

export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if (guard.error) return guard.error;

  await connectToDatabase();

  const body = await req.json();
  const parsed = createSlaRuleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  if (parsed.data.isActive) {
    const existingActive = await SLARule.findOne({
      categoryRef: parsed.data.categoryRef,
      priority: parsed.data.priority,
      isActive: true,
    });
    if (existingActive) {
      return NextResponse.json(
        {
          error:
            "An active SLA rule already exists for this category+priority. Deactivate it first.",
        },
        { status: 409 },
      );
    }
  }

  const rule = await SLARule.create(parsed.data);

  await writeAuditLog({
    actorId: guard.session.user.id,
    action: "sla_rule.create",
    entityType: "SLARule",
    entityId: rule._id,
    afterState: rule.toObject(),
    ipAddress: req.headers.get("x-forwarded-for"),
    userAgent: req.headers.get("user-agent"),
  });

  return NextResponse.json({ rule }, { status: 201 });
}
