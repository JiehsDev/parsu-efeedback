// src/features/reports/services/report-data.service.ts
import { Complaint } from "@/models/Complaint";
import { Types } from "mongoose";

export interface ReportFilters {
  officeRef?: string | null;
  collegeRef?: string | null;
  categoryRef?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  status?: string | null;
  slaOnly?: boolean;
}

export interface ReportRow {
  ticketNumber: string;
  title: string;
  status: string;
  priority: string;
  officeName: string;
  categoryName: string;
  // Student identity is kept out of reports — ID + college only, not
  // name, so an exported file reads a little more anonymous.
  studentId: string;
  studentCollege: string;
  submittedAt: string;
  resolvedAt: string;
  slaCompliant: string;
}

// BR-081: filterable by office, college, category, date range, status, SLA.
// The caller (API route) is responsible for constraining officeRef/collegeRef
// to what the requesting role is actually allowed to see (BR-092..096) —
// this function just applies whatever filter object it's given.
export async function queryReportData(filters: ReportFilters): Promise<ReportRow[]> {
  const pipeline: any[] = [
    {
      // Projected here (not just hidden downstream) so the student's name
      // never leaves the database in the first place — only the ID and
      // college feed into the report.
      $lookup: {
        from: "users",
        let: { studentId: "$studentRef" },
        pipeline: [
          { $match: { $expr: { $eq: ["$_id", "$$studentId"] } } },
          { $project: { employeeOrStudentId: 1, collegeRef: 1 } },
        ],
        as: "student",
      },
    },
    { $unwind: "$student" },
    {
      $lookup: {
        from: "offices",
        localField: "student.collegeRef",
        foreignField: "_id",
        as: "studentCollege",
      },
    },
    { $unwind: { path: "$studentCollege", preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: "offices",
        localField: "assignedOfficeRef",
        foreignField: "_id",
        as: "office",
      },
    },
    { $unwind: { path: "$office", preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: "categories",
        localField: "categoryRef",
        foreignField: "_id",
        as: "category",
      },
    },
    { $unwind: { path: "$category", preserveNullAndEmptyArrays: true } },
  ];

  const match: Record<string, unknown> = { isArchived: false };
  if (filters.officeRef) match.assignedOfficeRef = new Types.ObjectId(filters.officeRef);
  if (filters.collegeRef) match["student.collegeRef"] = new Types.ObjectId(filters.collegeRef);
  if (filters.categoryRef) match.categoryRef = new Types.ObjectId(filters.categoryRef);
  if (filters.status) match.status = filters.status;
  if (filters.dateFrom || filters.dateTo) {
    match.createdAt = {} as Record<string, Date>;
    if (filters.dateFrom) (match.createdAt as any).$gte = new Date(filters.dateFrom);
    if (filters.dateTo) (match.createdAt as any).$lte = new Date(filters.dateTo);
  }

  pipeline.push({ $match: match });
  pipeline.push({ $sort: { createdAt: -1 } });

  const results = await Complaint.aggregate(pipeline);

  const rows: ReportRow[] = results.map((c: any) => {
    const slaCompliant =
      c.status === "resolved" || c.status === "closed"
        ? c.resolvedAt &&
          c.slaResolutionDueAt &&
          new Date(c.resolvedAt) <= new Date(c.slaResolutionDueAt)
          ? "Yes"
          : "No"
        : "N/A";

    return {
      ticketNumber: c.ticketNumber,
      title: c.title,
      status: c.status,
      priority: c.priority,
      officeName: c.office?.name ?? "—",
      categoryName: c.category?.name ?? "—",
      studentId: c.student.employeeOrStudentId ?? "—",
      studentCollege: c.studentCollege?.name ?? "—",
      submittedAt: new Date(c.submittedAt).toLocaleDateString(),
      resolvedAt: c.resolvedAt ? new Date(c.resolvedAt).toLocaleDateString() : "—",
      slaCompliant,
    };
  });

  // BR-081 "SLA" filter: when slaOnly is set, keep only overdue/non-compliant rows
  return filters.slaOnly ? rows.filter((r) => r.slaCompliant === "No") : rows;
}
