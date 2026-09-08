// src/app/api/analytics/trends/route.ts
import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { auth } from "@/lib/auth";
import {
  getMonthlyTrends,
  getCollegeComparison,
  getCategoryBreakdown,
  getPriorityBreakdown,
} from "@/features/analytics/services/analytics.service";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // BR-095/096: analytics access itself is role-gated, separate from the
  // underlying complaint-access scoping. vpaa/vpaf/osas get their (scoped)
  // analytics through /admin/dashboard instead of this institution-wide
  // endpoint — see src/lib/admin-scope.ts.
  const { role } = session.user;
  if (!["qa_office", "administrator"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await connectToDatabase();

  const scopeMatch: Record<string, unknown> = { isArchived: false };
  const collegeComparison = await getCollegeComparison();

  const [trends, categoryBreakdown, priorityBreakdown] = await Promise.all([
    getMonthlyTrends(scopeMatch),
    getCategoryBreakdown(scopeMatch),
    getPriorityBreakdown(scopeMatch),
  ]);

  return NextResponse.json({ trends, collegeComparison, categoryBreakdown, priorityBreakdown });
}
