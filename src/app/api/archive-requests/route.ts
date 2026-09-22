import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { ArchiveRequest } from "@/models/ArchiveRequest";
import { Office } from "@/models/Office";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await connectToDatabase();
  const isAdmin = session.user.role === "administrator";
  const offices = isAdmin ? null : await Office.find({ headUserRef: session.user.id }).select("_id").lean();
  if (!isAdmin && !offices?.length) return NextResponse.json({ requests: [] });
  const filter: Record<string, any> = isAdmin ? { status: "pending" } : { status: "pending", officeRef: { $in: offices!.map((office) => office._id) } };
  const requests = await ArchiveRequest.find(filter)
    .sort({ createdAt: -1 })
    .populate("complaintRef", "ticketNumber title description status assignedOfficeRef assignedStaffRef archiveReason")
    .populate("officeRef", "name type code headUserRef")
    .populate("requestedByRef", "firstName lastName role")
    .lean();
  return NextResponse.json({ requests });
}
