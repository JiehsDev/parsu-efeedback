import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { isOsasHead } from "@/lib/osas-operations";
import { listPendingOfficeReturnRequests } from "@/features/complaints/services/office-return-query.service";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await connectToDatabase();
  if (!(await isOsasHead(session)))
    return NextResponse.json({ error: "Only the active OSAS Office Head may review return requests." }, { status: 403 });
  const requests = await listPendingOfficeReturnRequests(session);
  return NextResponse.json({ requests });
}
