import { isOsasHead } from "@/lib/osas-operations";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { ArchiveRequest } from "@/models/ArchiveRequest";
import { Office } from "@/models/Office";
import { Complaint } from "@/models/Complaint";
import { complaintFilterForScope, getAdminScope, isScopedAdminRole } from "@/lib/admin-scope";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await connectToDatabase();
  if (session.user.role !== "administrator" && !(await isOsasHead(session)))
    return NextResponse.json({ error: "Only the OSAS Head can review archives." }, { status: 403 });
  const isAdmin = session.user.role === "administrator";
  const offices = isAdmin
    ? null
    : await Office.find({ headUserRef: session.user.id }).select("_id").lean();
  if (!isAdmin && !offices?.length) return NextResponse.json({ requests: [] });
  const filter: Record<string, any> = isAdmin
    ? { status: "pending" }
    : { status: "pending", officeRef: { $in: offices!.map((office) => office._id) } };
  if (isScopedAdminRole(session.user.role)) {
    const complaints = await Complaint.find(
      await complaintFilterForScope(getAdminScope(session.user.role)),
    )
      .select("_id")
      .lean();
    filter.complaintRef = { $in: complaints.map((complaint) => complaint._id) };
  }
  const requests = await ArchiveRequest.find(filter)
    .sort({ createdAt: -1 })
    .populate(
      "complaintRef",
      "ticketNumber title description status assignedOfficeRef assignedStaffRef archiveReason",
    )
    .populate("officeRef", "name type code headUserRef")
    .populate("requestedByRef", "firstName lastName role")
    .lean();
  return NextResponse.json({ requests });
}
