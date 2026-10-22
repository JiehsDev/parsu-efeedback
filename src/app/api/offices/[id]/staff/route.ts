import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { getOperationalOffice, isOsasHead, refId } from "@/lib/osas-operations";
import { User } from "@/models/User";
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await connectToDatabase();
  const office = await getOperationalOffice();
  const { id } = await params;
  if (
    !office ||
    id !== refId(office._id) ||
    (session.user.role !== "administrator" && !(await isOsasHead(session)))
  )
    return NextResponse.json(
      { error: "Only the OSAS Head can select assignees." },
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
