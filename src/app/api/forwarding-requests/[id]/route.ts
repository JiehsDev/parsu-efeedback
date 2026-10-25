import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { auth } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { changeForwarding, ForwardingError } from "@/features/forwarding/forwarding.service";
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!isValidObjectId(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await connectToDatabase();
  try {
    return NextResponse.json({
      request: await changeForwarding(session, { requestId: id, body: await req.json() }),
    });
  } catch (error) {
    if (error instanceof ForwardingError)
      return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("Forwarding decision failed", error);
    return NextResponse.json(
      { error: "Could not decide forwarding. Please try again." },
      { status: 500 },
    );
  }
}
