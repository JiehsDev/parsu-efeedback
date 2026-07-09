// src/app/api/admin/offices/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { requireAdmin } from "@/lib/api-guards";
import { Office } from "@/models/Office";
import { createOfficeSchema } from "@/features/admin/schemas/office.schema";
import { writeAuditLog } from "@/features/audit-log/services/audit-log.service";

export async function GET(req: NextRequest) {
  const guard = await requireAdmin();
  if (guard.error) return guard.error;

  await connectToDatabase();

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const filter: Record<string, unknown> = {};
  if (type) filter.type = type;

  const offices = await Office.find(filter).sort({ name: 1 }).lean();
  return NextResponse.json({ offices });
}

export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if (guard.error) return guard.error;

  await connectToDatabase();

  const body = await req.json();
  const parsed = createOfficeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await Office.findOne({ code: parsed.data.code });
  if (existing) {
    return NextResponse.json({ error: "Office code already exists" }, { status: 409 });
  }

  const office = await Office.create(parsed.data);

  await writeAuditLog({
    actorId: guard.session.user.id,
    action: "office.create",
    entityType: "Office",
    entityId: office._id,
    afterState: office.toObject(),
    ipAddress: req.headers.get("x-forwarded-for"),
    userAgent: req.headers.get("user-agent"),
  });

  return NextResponse.json({ office }, { status: 201 });
}