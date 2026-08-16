// src/app/api/admin/settings/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-guards";
import { getSettings, updateSettings } from "@/features/settings/services/settings.service";
import { updateSettingsSchema } from "@/features/settings/schemas/settings.schema";
import { writeAuditLog } from "@/features/audit-log/services/audit-log.service";

export async function GET() {
  const guard = await requireAdmin();
  if (guard.error) return guard.error;

  const settings = await getSettings();
  return NextResponse.json({ settings });
}

export async function PATCH(req: NextRequest) {
  const guard = await requireAdmin();
  if (guard.error) return guard.error;

  const body = await req.json();
  const parsed = updateSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const before = await getSettings();
  const settings = await updateSettings(parsed.data);

  await writeAuditLog({
    actorId: guard.session.user.id,
    action: "settings.update",
    entityType: "Settings",
    entityId: "global",
    beforeState: before,
    afterState: settings,
    ipAddress: req.headers.get("x-forwarded-for"),
    userAgent: req.headers.get("user-agent"),
  });

  return NextResponse.json({ settings });
}
