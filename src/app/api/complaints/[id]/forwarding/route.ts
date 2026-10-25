import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { auth } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { Complaint } from "@/models/Complaint";
import { ForwardingRequest } from "@/models/ForwardingRequest";
import { canAccessComplaint } from "@/lib/complaint-access";
import { changeForwarding, ForwardingError } from "@/features/forwarding/forwarding.service";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!isValidObjectId(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await connectToDatabase();
  try {
    const request = await changeForwarding(session, { complaintId: id, body: await req.json() });
    return NextResponse.json({ request }, { status: 201 });
  } catch (error) {
    if (error instanceof ForwardingError)
      return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("Forwarding failed", error);
    return NextResponse.json(
      { error: "Could not save forwarding. Please try again." },
      { status: 500 },
    );
  }
}
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!isValidObjectId(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await connectToDatabase();
  const complaint = await Complaint.findById(id).lean();
  if (!complaint) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await canAccessComplaint(session, complaint)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const requests = await ForwardingRequest.find({ complaintRef: id })
    .sort({ requestedAt: -1 })
    .populate("requestedByUserRef reviewedByUserRef", "firstName lastName role")
    .lean();
  return NextResponse.json({ requests });
}
