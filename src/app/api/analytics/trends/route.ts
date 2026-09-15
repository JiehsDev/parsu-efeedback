// src/app/api/analytics/trends/route.ts
import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { auth } from "@/lib/auth";
import {
  getAnalyticsSummary,
  getMonthlyTrends,
  getCollegeComparison,
  getCategoryBreakdown,
  getPriorityBreakdown,
  getOfficeBreakdown,
} from "@/features/analytics/services/analytics.service";
import { complaintFilterForScope, getAdminScope } from "@/lib/admin-scope";

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
  if (!["administrator", "vpaa", "vpaf", "osas", "office_staff"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await connectToDatabase();

  let scopeMatch: Record<string, unknown> = {};
  if (role === "office_staff") {
    scopeMatch = { assignedOfficeRef: session.user.officeRef };
  } else {
    scopeMatch = await complaintFilterForScope(getAdminScope(role));
  }
  const collegeComparison = role === "office_staff" ? [] : await getCollegeComparison();

  const [summary, trends, categoryBreakdown, priorityBreakdown, officeBreakdown] = await Promise.all([
    getAnalyticsSummary(scopeMatch),
    getMonthlyTrends(scopeMatch),
    getCategoryBreakdown(scopeMatch),
    getPriorityBreakdown(scopeMatch),
    getOfficeBreakdown(scopeMatch),
  ]);

  return NextResponse.json({
    summary,
    trends,
    collegeComparison,
    categoryBreakdown,
    priorityBreakdown,
    officeBreakdown,
  });
}
