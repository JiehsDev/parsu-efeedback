// src/app/api/offices/[id]/staff/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { auth } from "@/lib/auth";
import { User } from "@/models/User";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!["college_dean", "administrator"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await connectToDatabase();
  const { id } = await params;

  const staff = await User.find({ officeRef: id, role: "office_staff", isActive: true })
    .select("firstName lastName email")
    .sort({ firstName: 1 })
    .lean();

  return NextResponse.json({ staff });
}
