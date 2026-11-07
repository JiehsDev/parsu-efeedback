import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { listPendingResolutionRequestsForHead } from "@/features/complaints/services/resolution-request-query.service";
import { isResolutionRequestHead } from "@/features/complaints/services/resolution-request-query.service";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await isResolutionRequestHead(session.user))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await connectToDatabase();
  const requests = await listPendingResolutionRequestsForHead(session.user);
  return NextResponse.json({ requests });
}
