// src/app/api/offices/[id]/staff/route.ts
import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { auth } from "@/lib/auth";
import { User } from "@/models/User";
import { Office } from "@/models/Office";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ staff: [] });
  }
  await connectToDatabase();
  const office = await Office.findById(id).select("code type headUserRef").lean();
  const osasMayView =
    session.user.role === "osas" &&
    office &&
    ((office as any).type === "college_office" ||
      (office as any).code === "OSAS" ||
      (office as any).code === "OVPAA");
  const mayViewStaff =
    ["vpaa", "vpaf", "administrator"].includes(session.user.role) ||
    (session.user.role === "office_staff" && session.user.officeRef === id) ||
    osasMayView;
  if (!mayViewStaff) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (session.user.role === "office_staff" && String((office as any)?.headUserRef ?? "") !== session.user.id) {
    return NextResponse.json({ error: "Only the office head can view assignable staff." }, { status: 403 });
  }

  // The office head is a User with role "office_staff" in this office too,
  // but they assign complaints — they don't appear as an assignable target
  // in their own dropdown.
  const headUserRef = (office as any)?.headUserRef ?? null;
  const staff = await User.find({
    officeRef: id,
    role: "office_staff",
    isActive: true,
    ...(headUserRef ? { _id: { $ne: headUserRef } } : {}),
  })
    .select("firstName lastName email")
    .sort({ firstName: 1 })
    .lean();

  return NextResponse.json({ staff });
}
