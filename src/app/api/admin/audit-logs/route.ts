// src/app/api/admin/audit-logs/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { requireAdmin } from "@/lib/api-guards";
import { AuditLog } from "@/models/AuditLog";

export async function GET(req: NextRequest) {
  const guard = await requireAdmin();
  if (guard.error) return guard.error;

  await connectToDatabase();

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const limit = 50;
  const entityType = searchParams.get("entityType");
  const action = searchParams.get("action");

  const filter: Record<string, unknown> = {};
  if (entityType) filter.entityType = entityType;
  if (action) filter.action = { $regex: action, $options: "i" };

  const [logs, total] = await Promise.all([
    AuditLog.find(filter)
      .populate("actorRef", "firstName lastName email")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    AuditLog.countDocuments(filter),
  ]);

  return NextResponse.json({ logs, total, page, limit });
}
