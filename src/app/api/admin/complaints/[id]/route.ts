import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { requireScopedAdmin } from "@/lib/api-guards";
import { Complaint } from "@/models/Complaint";
import { archiveComplaintSchema } from "@/features/complaints/schemas/complaint.schema";
import { archiveComplaint, restoreComplaint } from "@/lib/archive-workflow";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireScopedAdmin();
  if (guard.error) return guard.error;
  if (guard.session.user.role !== "administrator") return NextResponse.json({ error: "Only administrators may use this direct archive endpoint." }, { status: 403 });
  await connectToDatabase();
  const { id } = await params;
  const parsed = archiveComplaintSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  if (!(await Complaint.exists({ _id: id }))) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const result = parsed.data.isArchived
    ? await archiveComplaint({ complaintId: id, actorId: guard.session.user.id, reason: parsed.data.reason, source: "administrator_direct" })
    : await restoreComplaint({ complaintId: id, actorId: guard.session.user.id, reason: parsed.data.reason });
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ complaint: result.complaint });
}
