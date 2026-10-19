import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-guards";
import {
  planSlaRecalculation,
  applySlaRecalculation,
} from "@/features/sla/services/sla-recalculation.service";
import { writeAuditLog } from "@/features/audit-log/services/audit-log.service";

export async function GET() {
  const guard = await requireAdmin();
  if (guard.error) return guard.error;
  const plan = await planSlaRecalculation();
  return NextResponse.json({
    token: plan.token,
    count: plan.rows.length,
    skipped: plan.skipped,
    sample: plan.rows.slice(0, 20),
  });
}

export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if (guard.error) return guard.error;
  const body = await req.json().catch(() => null);
  const plan = await planSlaRecalculation();
  if (typeof body?.token !== "string" || body.token !== plan.token) {
    return NextResponse.json(
      { error: "The calendar or complaints changed. Refresh the preview before applying." },
      { status: 409 },
    );
  }
  const result = await applySlaRecalculation(plan, guard.session.user.id);
  await writeAuditLog({
    actorId: guard.session.user.id,
    action: "complaint.sla_calendar_recalculate",
    entityType: "Complaint",
    entityId: "sla-calendar",
    beforeState: { complaintsPlanned: plan.rows.length },
    afterState: { ...result, previewToken: plan.token },
    ipAddress: req.headers.get("x-forwarded-for"),
    userAgent: req.headers.get("user-agent"),
  });
  return NextResponse.json(result);
}
