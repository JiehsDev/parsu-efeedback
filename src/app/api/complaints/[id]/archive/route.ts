import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { Complaint } from "@/models/Complaint";
import { archiveComplaint, isOfficeHead, restoreComplaint } from "@/lib/archive-workflow";
import { archiveComplaintSchema } from "@/features/complaints/schemas/complaint.schema";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await connectToDatabase();
  const { id } = await params;
  const parsed = archiveComplaintSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const complaint = await Complaint.findById(id).lean();
  if (!complaint) return NextResponse.json({ error: "Complaint not found" }, { status: 404 });
  const isAdmin = session.user.role === "administrator";
  const head = await isOfficeHead(session.user.id, complaint.assignedOfficeRef);
  if (!isAdmin && !head) return NextResponse.json({ error: "Only the responsible office head or administrator can archive complaints directly." }, { status: 403 });
  if (!parsed.data.isArchived) {
    if (!isAdmin && !head) return NextResponse.json({ error: "Only the responsible office head or administrator can restore complaints." }, { status: 403 });
    const result = await restoreComplaint({ complaintId: id, actorId: session.user.id, reason: parsed.data.reason });
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ complaint: result.complaint });
  }
  const result = await archiveComplaint({ complaintId: id, actorId: session.user.id, reason: parsed.data.reason, source: isAdmin ? "administrator_direct" : "office_head_direct" });
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ complaint: result.complaint });
}
