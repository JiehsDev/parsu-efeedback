// src/app/api/admin/audit-logs/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { requireAdmin } from "@/lib/api-guards";
import { AuditLog } from "@/models/AuditLog";
import { User } from "@/models/User";

export async function GET(req: NextRequest) {
  const guard = await requireAdmin();
  if (guard.error) return guard.error;

  await connectToDatabase();

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const limit = 50;
  const entityType = searchParams.get("entityType");
  const action = searchParams.get("action");
  const actor = searchParams.get("actor");
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");

  const filter: Record<string, unknown> = {};
  if (entityType) filter.entityType = entityType;
  if (action) filter.action = { $regex: action, $options: "i" };

  // actorRef is a reference, not free text, so a name/email search has to
  // resolve to actor ids first — an empty match set must still filter to
  // "no logs" rather than falling through to "no actor filter at all".
  if (actor) {
    const matchingActors = await User.find({
      $or: [
        { firstName: { $regex: actor, $options: "i" } },
        { lastName: { $regex: actor, $options: "i" } },
        { email: { $regex: actor, $options: "i" } },
      ],
    })
      .select("_id")
      .lean();
    filter.actorRef = { $in: matchingActors.map((u) => u._id) };
  }

  if (dateFrom || dateTo) {
    const createdAt: Record<string, Date> = {};
    if (dateFrom) createdAt.$gte = new Date(dateFrom);
    if (dateTo) {
      // Treat the "To" date as inclusive of its whole day, not midnight
      // at its start — an admin picking today's date expects today's
      // entries included.
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      createdAt.$lte = end;
    }
    filter.createdAt = createdAt;
  }

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
