import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { ForwardingRequest } from "@/models/ForwardingRequest";
import { forwardingHistoryFilter, ForwardingError } from "@/features/forwarding/forwarding.service";
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await connectToDatabase();
  try {
    const filter = await forwardingHistoryFilter(session);
    const status = req.nextUrl.searchParams.get("status");
    if (status && !["pending", "approved", "rejected"].includes(status))
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    const requests = await ForwardingRequest.find({
      ...filter,
      ...(status ? { status: status as "pending" | "approved" | "rejected" } : {}),
    })
      .sort({ requestedAt: -1 })
      .limit(100)
      .populate("complaintRef", "ticketNumber title")
      .populate("requestedByUserRef reviewedByUserRef", "firstName lastName")
      .lean();
    return NextResponse.json({ requests });
  } catch (error) {
    if (error instanceof ForwardingError)
      return NextResponse.json({ error: error.message }, { status: error.status });
    throw error;
  }
}
