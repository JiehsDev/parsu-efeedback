// src/app/api/admin/offices/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { requireScopedAdmin } from "@/lib/api-guards";
import { Office } from "@/models/Office";
import { User } from "@/models/User";
import { createOfficeSchema } from "@/features/admin/schemas/office.schema";
import { writeAuditLog } from "@/features/audit-log/services/audit-log.service";
import { officeFilterForScope } from "@/lib/admin-scope";

export async function GET(req: NextRequest) {
  const guard = await requireScopedAdmin();
  if (guard.error) return guard.error;
  const { scope } = guard;

  // osas has no Offices access at all — not even read.
  if (scope.kind === "student") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await connectToDatabase();

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const filter: Record<string, unknown> = { ...officeFilterForScope(scope) };
  if (type) filter.type = type;

  const offices = await Office.find(filter)
    .populate("parentOffice", "name code")
    .populate("headUserRef", "firstName lastName email isActive")
    .sort({ name: 1 })
    .lean();
  const staffCounts = await User.aggregate([
    { $match: { role: { $ne: "student" }, officeRef: { $ne: null } } },
    { $group: { _id: "$officeRef", count: { $sum: 1 } } },
  ]);
  const countByOffice = new Map(staffCounts.map((row: any) => [String(row._id), row.count]));

  return NextResponse.json({
    offices: offices.map((office: any) => ({
      ...office,
      staffCount: countByOffice.get(String(office._id)) ?? 0,
    })),
  });
}

export async function POST(req: NextRequest) {
  const guard = await requireScopedAdmin();
  if (guard.error) return guard.error;
  const { scope } = guard;

  if (scope.kind === "student") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await connectToDatabase();

  const body = await req.json();
  const parsed = createOfficeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // vpaa/vpaf may only create an office in their own category — an admin
  // (scope.kind "all") can create either.
  if (
    (scope.kind === "college_office" || scope.kind === "university_office") &&
    parsed.data.type !== scope.kind
  ) {
    return NextResponse.json(
      { error: "You can only create offices in your own office category" },
      { status: 403 },
    );
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
