// src/app/api/offices/route.ts
import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { auth } from "@/lib/auth";
import { Office } from "@/models/Office";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectToDatabase();

  const offices = await Office.find({ isActive: true })
    .select("name code type")
    .sort({ name: 1 })
    .lean();

  return NextResponse.json({ offices });
}
