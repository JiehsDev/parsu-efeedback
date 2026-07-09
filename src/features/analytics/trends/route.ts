// src/app/api/analytics/trends/route.ts — updated
import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { auth } from "@/lib/auth";
import {
  getMonthlyTrends,
  getCollegeComparison,
  getCategoryBreakdown,
  getPriorityBreakdown,
} from "@/features/analytics/services/analytics.service";
import { Types } from "mongoose";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { role } = session.user;
  if (!["college_dean", "qa_office", "administrator"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await connectToDatabase();

  let scopeMatch: Record<string, unknown> = { isArchived: false };
  let collegeComparison = null;

  if (role === "college_dean") {
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
  } else {
    collegeComparison = await getCollegeComparison();
  }

  const [trends, categoryBreakdown, priorityBreakdown] = await Promise.all([
    getMonthlyTrends(scopeMatch),
    getCategoryBreakdown(scopeMatch),
    getPriorityBreakdown(scopeMatch),
  ]);

  return NextResponse.json({ trends, collegeComparison, categoryBreakdown, priorityBreakdown });
}
