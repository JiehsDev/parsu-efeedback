// src/app/api/colleges/route.ts
import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { Office } from "@/models/Office";

// Public, read-only, minimal fields only — used by the registration form
// before a session exists. Never exposes headUserRef or other admin data.
export async function GET() {
  await connectToDatabase();

  const colleges = await Office.find({ type: "college", isActive: true })
    .select("name code")
    .sort({ name: 1 })
    .lean();

  return NextResponse.json({ colleges });
}
