// src/app/api/admin/complaints/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { requireAdmin } from "@/lib/api-guards";
import { Complaint } from "@/models/Complaint";
import { archiveComplaintSchema } from "@/features/complaints/schemas/complaint.schema";
import { writeAuditLog } from "@/features/audit-log/services/audit-log.service";

// BR-045: archiving is the only admin-specific write this route exists
// for — status changes stay on /api/complaints/[id], which every
// role-scoped detail page already uses.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin();
  if (guard.error) return guard.error;

  await connectToDatabase();
  const { id } = await params;

  const body = await req.json();
  const parsed = archiveComplaintSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const before = await Complaint.findById(id).select("isArchived ticketNumber").lean();
  if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const after = await Complaint.findByIdAndUpdate(
    id,
    { isArchived: parsed.data.isArchived },
    { returnDocument: "after" },
  ).lean();

  await writeAuditLog({
    actorId: guard.session.user.id,
    action: parsed.data.isArchived ? "complaint.archive" : "complaint.unarchive",
    entityType: "Complaint",
    entityId: id,
    beforeState: before,
    afterState: after,
    ipAddress: req.headers.get("x-forwarded-for"),
    userAgent: req.headers.get("user-agent"),
  });

  return NextResponse.json({ complaint: after });
}
