// src/app/api/admin/categories/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { requireAdmin } from "@/lib/api-guards";
import { Category } from "@/models/Category";
import { createCategorySchema } from "@/features/admin/schemas/category.schema";
import { writeAuditLog } from "@/features/audit-log/services/audit-log.service";

export async function GET(req: NextRequest) {
  const guard = await requireAdmin();
  if (guard.error) return guard.error;

  await connectToDatabase();
  const categories = await Category.find().sort({ name: 1 }).lean();
  return NextResponse.json({ categories });
}

export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if (guard.error) return guard.error;

  await connectToDatabase();

  const body = await req.json();
  const parsed = createCategorySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await Category.findOne({ name: parsed.data.name });
  if (existing) {
    return NextResponse.json({ error: "Category name already exists" }, { status: 409 });
  }

  // BR-023: a category can't be selectable until it has an active routing
  // rule. Since the rule references categoryRef, the category must exist
  // first — so it's always created inactive; PATCH is where it gets
  // switched on, once a rule exists.
  const category = await Category.create({ ...parsed.data, isActive: false });

  await writeAuditLog({
    actorId: guard.session.user.id,
    action: "category.create",
    entityType: "Category",
    entityId: category._id,
    afterState: category.toObject(),
    ipAddress: req.headers.get("x-forwarded-for"),
    userAgent: req.headers.get("user-agent"),
  });

  return NextResponse.json(
    {
      category,
      message:
        "Category created as inactive. Create an active routing rule for it, then PATCH isActive:true to enable it.",
    },
    { status: 201 },
  );
}
