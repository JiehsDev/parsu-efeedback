import { elapsedSlaMs } from "@/lib/sla-calendar";
// src/features/reports/services/report-data.service.ts
import { SLA_TIME_ZONE } from "@/lib/sla-calendar";
import { Complaint } from "@/models/Complaint";
import { Types } from "mongoose";

export interface ReportFilters {
  domain?: string | null;
  priority?: string | null;
  slaState?: string | null;
  officeRef?: string | null;
  // Forced by the API route for vpaa/vpaf (their office category's office
  // ids) — narrower than a single officeRef when the caller hasn't also
  // picked one specific office. Never set by the client directly.
  officeRefIn?: string[] | null;
  collegeRef?: string | null;
  categoryRef?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  status?: string | null;
  slaOnly?: boolean;
}

export interface ReportRow {
  forwardedTo?: string;
  forwardedAt?: string;
  ticketNumber: string;
  title: string;
  status: string;
  priority: string;
  officeName: string;
  categoryName: string;
  domain?: string;
  responseHours?: string;
  resolutionHours?: string;
  // Student identity is kept out of reports — ID + college only, not
  // name, so an exported file reads a little more anonymous.
  studentId: string;
  studentCollege: string;
  submittedAt: string;
  resolvedAt: string;
  resolutionSummary: string;
  slaCalendar: string;
  slaCompliant: string;
}

// BR-081: filterable by office, college, category, date range, status, SLA.
// The caller (API route) is responsible for constraining officeRef/collegeRef
// to what the requesting role is actually allowed to see (BR-092..096) —
// this function just applies whatever filter object it's given.
export async function queryReportData(
  filters: ReportFilters,
  accessFilter: Record<string, unknown> = {},
): Promise<ReportRow[]> {
  const pipeline: any[] = [
    { $match: accessFilter },
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
  if (filters.officeRef) {
    match.assignedOfficeRef = new Types.ObjectId(filters.officeRef);
  } else if (filters.officeRefIn) {
    match.assignedOfficeRef = { $in: filters.officeRefIn.map((id) => new Types.ObjectId(id)) };
  }
  if (filters.collegeRef) match["student.collegeRef"] = new Types.ObjectId(filters.collegeRef);
  if (filters.categoryRef) match.categoryRef = new Types.ObjectId(filters.categoryRef);
  if (filters.status) match.status = filters.status;
  if (filters.domain) match["category.domain"] = filters.domain;
  if (filters.priority) match.priority = filters.priority;
  if (filters.slaState) {
    const due = {
      $cond: [
        { $eq: [{ $ifNull: ["$assignedStaffRef", null] }, null] },
        "$slaResponseDueAt",
        "$slaResolutionDueAt",
      ],
    };
    const now = new Date();
    const soon = new Date(now.getTime() + 86400000);
    match.status = { $nin: ["closed", "resolved", "withdrawn"] };
    if (filters.status) match.status = filters.status;
    match.$expr =
      filters.slaState === "overdue"
        ? { $lt: [due, now] }
        : filters.slaState === "due_soon"
          ? { $and: [{ $gte: [due, now] }, { $lte: [due, soon] }] }
          : { $gt: [due, soon] };
  }
  if (filters.dateFrom || filters.dateTo) {
    match.createdAt = {} as Record<string, Date>;
    if (filters.dateFrom) (match.createdAt as any).$gte = new Date(filters.dateFrom);
    if (filters.dateTo) (match.createdAt as any).$lte = new Date(filters.dateTo);
  }

  pipeline.push({ $match: match });
  pipeline.push({
    $lookup: {
      from: "assignments",
      let: { complaintId: "$_id" },
      pipeline: [
        {
          $match: {
            $expr: {
              $and: [
                { $eq: ["$complaintRef", "$$complaintId"] },
                { $ne: ["$assignedByRef", null] },
                { $ne: ["$assignedToRef", null] },
              ],
            },
          },
        },
        { $sort: { createdAt: 1 } },
        { $limit: 1 },
      ],
      as: "firstAssignment",
    },
  });
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
      forwardedTo: c.forwardedToRole?.toUpperCase() ?? "",
      forwardedAt: c.forwardedAt ? new Date(c.forwardedAt).toISOString() : "",
      ticketNumber: c.ticketNumber,
      title: c.title,
      status: c.status,
      priority: c.priority,
      officeName: c.office?.name ?? "—",
      categoryName: c.category?.name ?? "—",
      studentId: c.student.employeeOrStudentId ?? "—",
      studentCollege: c.studentCollege?.name ?? "—",
      submittedAt: new Date(c.submittedAt).toLocaleDateString("en-PH", { timeZone: SLA_TIME_ZONE }),
      resolvedAt: c.resolvedAt
        ? new Date(c.resolvedAt).toLocaleDateString("en-PH", { timeZone: SLA_TIME_ZONE })
        : "—",
      domain: c.category?.domain ?? "other",
      responseHours: c.firstAssignment?.[0]?.createdAt
        ? (
            elapsedSlaMs(c.submittedAt, c.firstAssignment[0].createdAt, c.slaPolicy) / 3600000
          ).toFixed(2)
        : "",
      resolutionHours: c.resolvedAt
        ? (elapsedSlaMs(c.submittedAt, c.resolvedAt, c.slaPolicy) / 3600000).toFixed(2)
        : "",
      resolutionSummary: c.resolutionSummary
        ? `${["resolved", "closed"].includes(c.status) ? "" : "Previous resolution: "}${c.resolutionSummary}`
        : ["resolved", "closed"].includes(c.status)
          ? "No resolution details recorded."
          : "",
      slaCalendar:
        c.slaPolicy?.version === 1
          ? "24h weekdays; weekends and configured holidays excluded (Philippine time)"
          : "Calendar days, including weekends and holidays",
      slaCompliant,
    };
  });

  // BR-081 "SLA" filter: when slaOnly is set, keep only overdue/non-compliant rows
  return filters.slaOnly ? rows.filter((r) => r.slaCompliant === "No") : rows;
}
