// src/app/api/admin/notifications/broadcast/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { requireAdmin } from "@/lib/api-guards";
import { User } from "@/models/User";
import { Notification } from "@/models/Notification";
import { broadcastNotificationSchema } from "@/features/notifications/schemas/broadcast.schema";
import { writeAuditLog } from "@/features/audit-log/services/audit-log.service";

export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if (guard.error) return guard.error;

  await connectToDatabase();

  const body = await req.json();
  const parsed = broadcastNotificationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { title, body: message, audience, role, officeRef } = parsed.data;

  // In-app only (no email) — unlike every other notification path in this
  // app, a broadcast can fan out to hundreds of recipients at once, and
  // this app's email helpers (src/features/notifications/services/
  // email.service.ts) are all built for one recipient per call.
  const audienceFilter: Record<string, unknown> = { isActive: true };
  if (audience === "role") {
    audienceFilter.role = role;
  } else if (audience === "office") {
    audienceFilter.$or = [{ officeRef }, { collegeRef: officeRef }];
  }

  const recipients = await User.find(audienceFilter).select("_id").lean();
  if (recipients.length === 0) {
    return NextResponse.json({ error: "No active users match this audience." }, { status: 400 });
  }

  await Notification.insertMany(
    recipients.map((r) => ({
      userRef: r._id,
      type: "system_announcement",
      title,
      body: message,
      relatedComplaintRef: null,
    })),
  );

  await writeAuditLog({
    actorId: guard.session.user.id,
    action: "notification.broadcast",
    entityType: "Notification",
    entityId: `broadcast:${audience}${role ? `:${role}` : ""}${officeRef ? `:${officeRef}` : ""}`,
    afterState: { title, body: message, audience, role, officeRef, recipientCount: recipients.length },
    ipAddress: req.headers.get("x-forwarded-for"),
    userAgent: req.headers.get("user-agent"),
  });

  return NextResponse.json({ recipientCount: recipients.length }, { status: 201 });
}
