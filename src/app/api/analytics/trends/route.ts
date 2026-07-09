// src/app/api/analytics/trends/route.ts
import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { auth } from "@/lib/auth";
import {
  getMonthlyTrends,
  getCollegeComparison,
} from "@/features/analytics/services/analytics.service";
import { Types } from "mongoose";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // BR-095/096/094: analytics access itself is role-gated, separate from
  // the underlying complaint-access scoping.
  const { role } = session.user;
  if (!["college_dean", "qa_office", "administrator"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await connectToDatabase();

  let scopeMatch: Record<string, unknown> = { isArchived: false };
  let collegeComparison = null;

  if (role === "college_dean") {
    // Dean is college-scoped — needs the student join, same pattern used
    // elsewhere for dean-scoped queries. Since getMonthlyTrends takes a
    // flat $match, we pre-filter complaint IDs for this college first.
    const { Complaint } = await import("@/models/Complaint");
    const collegeRef = new Types.ObjectId(session.user.collegeRef);

    const collegeComplaintIds = await Complaint.aggregate([
      {
        $lookup: {
          from: "users",
          localField: "studentRef",
          foreignField: "_id",
          as: "student",
        },
      },
      { $unwind: "$student" },
      { $match: { "student.collegeRef": collegeRef } },
      { $project: { _id: 1 } },
    ]);

    scopeMatch = { _id: { $in: collegeComplaintIds.map((c: any) => c._id) }, isArchived: false };
    // No college comparison for dean — out of their scope entirely.
  } else {
    // qa_office / administrator — institution-wide, includes comparison
    collegeComparison = await getCollegeComparison();
  }

  const trends = await getMonthlyTrends(scopeMatch);

  return NextResponse.json({ trends, collegeComparison });
}
