// src/app/api/categories/route.ts
import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { auth } from "@/lib/auth";
import { Category } from "@/models/Category";

// Any authenticated user can see active categories (needed by the
// complaint submission form) — unlike /api/admin/categories, this never
// exposes inactive/draft categories or admin-only fields.
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectToDatabase();

  const categories = await Category.find({ isActive: true })
    .select("name description defaultPriority")
    .sort({ name: 1 })
    .lean();

  return NextResponse.json({ categories });
}
