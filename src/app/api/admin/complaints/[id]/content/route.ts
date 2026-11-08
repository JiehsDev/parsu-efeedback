import { correctComplaintContentSchema } from "@/features/complaints/schemas/complaint.schema";
import { correctComplaintContent } from "@/features/complaints/services/admin-content-correction.service";
import { requireAdmin } from "@/lib/api-guards";
import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin();
  if (guard.error) return guard.error;

  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const parsed = correctComplaintContentSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const result = await correctComplaintContent({
    complaintId: id,
    actorId: guard.session.user.id,
    ...parsed.data,
    ipAddress: req.headers.get("x-forwarded-for"),
    userAgent: req.headers.get("user-agent"),
  });
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ complaint: result.complaint });
}
