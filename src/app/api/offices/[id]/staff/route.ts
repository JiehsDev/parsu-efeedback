import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { canManageOfficeAssignments } from "@/lib/osas-operations";
import { Office } from "@/models/Office";
import { User } from "@/models/User";
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await connectToDatabase();
  const { id } = await params;
  const office = await Office.findById(id).lean();
  if (!office || !(await canManageOfficeAssignments(session, office)))
    return NextResponse.json(
      { error: "Only the responsible office head can select its assignees." },
      { status: 403 },
    );
  const staff = await User.find({
    officeRef: office._id,
    isActive: true,
    role: "office_staff",
    _id: { $ne: office.headUserRef },
  })
    .select("firstName lastName email")
    .sort({ firstName: 1 })
    .lean();
  return NextResponse.json({ staff });
}
