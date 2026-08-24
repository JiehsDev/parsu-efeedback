// src/app/api/admin/sla-rules/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { requireAdmin } from "@/lib/api-guards";
import { SLARule } from "@/models/SLARule";
import { Category } from "@/models/Category";
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

  // A category's priority only ever matters as "which SLA clock applies,"
  // so this is where it's actually chosen — not on the category itself
  // (see routing.service.ts/sla.service.ts, which resolve every complaint
  // under a category using Category.defaultPriority). Picking a priority
  // here for a category-scoped rule sets that category's defaultPriority
  // to match, rather than requiring it to already agree. Institution-wide
  // defaults (no categoryRef) skip this — their whole purpose is to vary
  // by priority independently of any one category.
  if (parsed.data.categoryRef) {
    const category = await Category.findById(parsed.data.categoryRef).lean();
    if (!category) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }
    if (parsed.data.priority !== (category as any).defaultPriority) {
      await Category.updateOne(
        { _id: parsed.data.categoryRef },
        { $set: { defaultPriority: parsed.data.priority } },
      );
    }
  }

  if (parsed.data.isActive) {
    // At most one active rule per category (BR-029, reconciled — see
    // SLARule.ts) — or, for an institution-wide default, at most one per
    // priority.
    const conflictFilter = parsed.data.categoryRef
      ? { categoryRef: parsed.data.categoryRef, isActive: true }
      : { categoryRef: null, priority: parsed.data.priority, isActive: true };
    const existingActive = await SLARule.findOne(conflictFilter);
    if (existingActive) {
      return NextResponse.json(
        {
          error: parsed.data.categoryRef
            ? "An active SLA rule already exists for this category. Edit or deactivate it first."
            : "An active institution-wide default already exists for this priority. Deactivate it first.",
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
