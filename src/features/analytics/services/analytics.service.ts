// src/features/analytics/services/analytics.service.ts
import { Complaint } from "@/models/Complaint";
import { Assignment } from "@/models/Assignment";
import { Types } from "mongoose";
import type { PipelineStage } from "mongoose";

interface MonthlyTrendPoint {
  month: string;
  volume: number;
  resolvedCount: number;
  slaCompliantCount: number;
  slaCompliancePercent: number;
}

export interface CategoryBreakdownPoint {
  category: string;
  volume: number;
}

export interface PriorityBreakdownPoint {
  priority: string;
  volume: number;
}

export interface OfficeBreakdownPoint {
  office: string;
  volume: number;
}

export interface SlaComplianceByOfficePoint {
  office: string;
  total: number;
  compliant: number;
  percent: number;
}

export interface AnalyticsSummary {
  totalComplaints: number;
  overdueComplaints: number;
  resolvedComplaints: number;
  unresolvedComplaints: number;
  averageFirstResponseHours: number | null;
  averageResolutionHours: number | null;
  slaComplianceRate: number;
  byStatus: Array<{ status: string; volume: number }>;
  officePerformance: SlaComplianceByOfficePoint[];
}

function roundHours(ms: number) {
  return Math.round((ms / 3_600_000) * 100) / 100;
}

export async function getAnalyticsSummary(
  scopeMatch: Record<string, unknown>,
): Promise<AnalyticsSummary> {
  const match = { isArchived: false, ...scopeMatch };

  const [complaints, byStatus, officePerformance] = await Promise.all([
    Complaint.find(match)
      .select("_id submittedAt resolvedAt slaResolutionDueAt status isOverdue")
      .lean(),
    Complaint.aggregate([
      { $match: match },
      { $group: { _id: "$status", volume: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    getSlaComplianceByOffice(scopeMatch),
  ]);

  const totalComplaints = complaints.length;
  const resolved = complaints.filter((c: any) => c.status === "resolved" || c.status === "closed");
  const unresolvedComplaints = complaints.filter(
    (c: any) => c.status !== "resolved" && c.status !== "closed" && c.status !== "withdrawn",
  ).length;
  const overdueComplaints = complaints.filter((c: any) => c.isOverdue).length;

  const resolutionDurations = resolved
    .filter((c: any) => c.resolvedAt && c.submittedAt)
    .map((c: any) => new Date(c.resolvedAt).getTime() - new Date(c.submittedAt).getTime())
    .filter((ms) => ms >= 0);

  const complaintIds = complaints.map((c: any) => c._id);
  const firstHumanAssignments = await Assignment.aggregate([
    {
      $match: {
        complaintRef: { $in: complaintIds },
        assignedByRef: { $ne: null },
      },
    },
    { $sort: { createdAt: 1 } },
    { $group: { _id: "$complaintRef", firstResponseAt: { $first: "$createdAt" } } },
  ]);
  const submittedById = new Map(complaints.map((c: any) => [String(c._id), c.submittedAt]));
  const firstResponseDurations = firstHumanAssignments
    .map((a: any) => {
      const submittedAt = submittedById.get(String(a._id));
      return submittedAt
        ? new Date(a.firstResponseAt).getTime() - new Date(submittedAt as any).getTime()
        : -1;
    })
    .filter((ms: number) => ms >= 0);

  const compliantResolved = resolved.filter(
    (c: any) =>
      c.resolvedAt &&
      c.slaResolutionDueAt &&
      new Date(c.resolvedAt).getTime() <= new Date(c.slaResolutionDueAt).getTime(),
  ).length;

  return {
    totalComplaints,
    overdueComplaints,
    resolvedComplaints: resolved.length,
    unresolvedComplaints,
    averageFirstResponseHours: firstResponseDurations.length
      ? roundHours(firstResponseDurations.reduce((sum, ms) => sum + ms, 0) / firstResponseDurations.length)
      : null,
    averageResolutionHours: resolutionDurations.length
      ? roundHours(resolutionDurations.reduce((sum, ms) => sum + ms, 0) / resolutionDurations.length)
      : null,
    slaComplianceRate: resolved.length ? Math.round((compliantResolved / resolved.length) * 100) : 0,
    byStatus: byStatus.map((row: any) => ({ status: row._id, volume: row.volume })),
    officePerformance,
  };
}

// BR-089 "Category Distribution" — scoped by the same flat $match pattern
// as getMonthlyTrends, so vpaa/vpaf/osas/admin all reuse this with their
// own pre-resolved scopeMatch.
export async function getCategoryBreakdown(
  scopeMatch: Record<string, unknown>,
): Promise<CategoryBreakdownPoint[]> {
  const pipeline: PipelineStage[] = [
    { $match: scopeMatch },
    {
      $lookup: {
        from: "categories",
        localField: "categoryRef",
        foreignField: "_id",
        as: "category",
      },
    },
    { $unwind: { path: "$category", preserveNullAndEmptyArrays: true } },
    {
      $group: {
        _id: { $ifNull: ["$category.name", "Uncategorized"] },
        volume: { $sum: 1 },
      },
    },
    { $sort: { volume: -1 } },
  ];

  const results = await Complaint.aggregate(pipeline);
  return results.map((r: any) => ({ category: r._id, volume: r.volume }));
}

export async function getPriorityBreakdown(
  scopeMatch: Record<string, unknown>,
): Promise<PriorityBreakdownPoint[]> {
  const pipeline: PipelineStage[] = [
    { $match: scopeMatch },
    { $group: { _id: "$priority", volume: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ];

  const results = await Complaint.aggregate(pipeline);
  const order = ["low", "medium", "high", "critical"];
  return results
    .map((r: any) => ({ priority: r._id, volume: r.volume }))
    .sort((a, b) => order.indexOf(a.priority) - order.indexOf(b.priority));
}

export async function getOfficeBreakdown(
  scopeMatch: Record<string, unknown>,
): Promise<OfficeBreakdownPoint[]> {
  const pipeline: PipelineStage[] = [
    { $match: scopeMatch },
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
      $group: {
        _id: { $ifNull: ["$office.name", "Unassigned"] },
        volume: { $sum: 1 },
      },
    },
    { $sort: { volume: -1 } },
  ];

  const results = await Complaint.aggregate(pipeline);
  return results.map((r: any) => ({ office: r._id, volume: r.volume }));
}

// Shared by the QA dashboard heatmap and the SLA Compliance page's office
// list so both surfaces always agree on the same numbers.
export async function getSlaComplianceByOffice(
  scopeMatch: Record<string, unknown> = {},
): Promise<SlaComplianceByOfficePoint[]> {
  const pipeline: PipelineStage[] = [
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
      $match: {
        isArchived: false,
        status: { $in: ["resolved", "closed"] },
        ...scopeMatch,
      },
    },
    {
      $addFields: {
        isCompliant: {
          $and: [
            { $ne: ["$resolvedAt", null] },
            { $ne: ["$slaResolutionDueAt", null] },
            { $lte: ["$resolvedAt", "$slaResolutionDueAt"] },
          ],
        },
      },
    },
    {
      $group: {
        _id: { $ifNull: ["$office.name", "Unassigned"] },
        total: { $sum: 1 },
        compliant: { $sum: { $cond: ["$isCompliant", 1, 0] } },
      },
    },
    { $sort: { total: -1 } },
  ];

  const results = await Complaint.aggregate(pipeline);
  return results.map((r: any) => ({
    office: r._id,
    total: r.total,
    compliant: r.compliant,
    percent: r.total > 0 ? Math.round((r.compliant / r.total) * 100) : 0,
  }));
}

export async function getMonthlyTrends(
  scopeMatch: Record<string, unknown>,
  monthsBack = 6,
): Promise<MonthlyTrendPoint[]> {
  const since = new Date();
  since.setMonth(since.getMonth() - monthsBack);
  since.setDate(1);
  since.setHours(0, 0, 0, 0);

  const pipeline: PipelineStage[] = [
    { $match: { ...scopeMatch, createdAt: { $gte: since } } },
    {
      $addFields: {
        month: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
        isResolved: { $in: ["$status", ["resolved", "closed"]] },
        isSlaCompliant: {
          $and: [
            { $in: ["$status", ["resolved", "closed"]] },
            { $ne: ["$resolvedAt", null] },
            { $ne: ["$slaResolutionDueAt", null] },
            { $lte: ["$resolvedAt", "$slaResolutionDueAt"] },
          ],
        },
      },
    },
    {
      $group: {
        _id: "$month",
        volume: { $sum: 1 },
        resolvedCount: { $sum: { $cond: ["$isResolved", 1, 0] } },
        slaCompliantCount: { $sum: { $cond: ["$isSlaCompliant", 1, 0] } },
      },
    },
    { $sort: { _id: 1 } },
  ];

  const results = await Complaint.aggregate(pipeline);

  return results.map((r: any) => ({
    month: r._id,
    volume: r.volume,
    resolvedCount: r.resolvedCount,
    slaCompliantCount: r.slaCompliantCount,
    slaCompliancePercent:
      r.resolvedCount > 0 ? Math.round((r.slaCompliantCount / r.resolvedCount) * 100) : 0,
  }));
}

export interface SlaTrendPoint {
  month: string;
  volume: number;
  slaCompliancePercent: number;
}

// Backs the SLA Compliance page's trend chart. Unlike getMonthlyTrends
// (a rolling "last N months" window), this scopes to one explicit
// calendar year — and, if a specific month within it is also picked,
// drills down to a daily series for just that month — plus an optional
// college filter (joined through the complainant's collegeRef, same
// pattern as getCollegeComparison).
export async function getSlaTrendSeries(params: {
  year: number;
  month?: number | null; // 1-12
  collegeId?: string | null;
}): Promise<SlaTrendPoint[]> {
  const { year, month, collegeId } = params;

  const rangeStart = month ? new Date(year, month - 1, 1) : new Date(year, 0, 1);
  const rangeEnd = month ? new Date(year, month, 1) : new Date(year + 1, 0, 1);

  const pipeline: PipelineStage[] = [];

  if (collegeId) {
    pipeline.push(
      {
        $lookup: {
          from: "users",
          localField: "studentRef",
          foreignField: "_id",
          as: "student",
        },
      },
      { $unwind: "$student" },
      { $match: { "student.collegeRef": new Types.ObjectId(collegeId) } },
    );
  }

  pipeline.push(
    {
      $match: {
        isArchived: false,
        createdAt: { $gte: rangeStart, $lt: rangeEnd },
      },
    },
    {
      $addFields: {
        bucket: {
          $dateToString: { format: month ? "%Y-%m-%d" : "%Y-%m", date: "$createdAt" },
        },
        isResolved: { $in: ["$status", ["resolved", "closed"]] },
        isSlaCompliant: {
          $and: [
            { $in: ["$status", ["resolved", "closed"]] },
            { $ne: ["$resolvedAt", null] },
            { $ne: ["$slaResolutionDueAt", null] },
            { $lte: ["$resolvedAt", "$slaResolutionDueAt"] },
          ],
        },
      },
    },
    {
      $group: {
        _id: "$bucket",
        volume: { $sum: 1 },
        resolvedCount: { $sum: { $cond: ["$isResolved", 1, 0] } },
        slaCompliantCount: { $sum: { $cond: ["$isSlaCompliant", 1, 0] } },
      },
    },
    { $sort: { _id: 1 } },
  );

  const results = await Complaint.aggregate(pipeline);
  return results.map((r: any) => ({
    month: r._id,
    volume: r.volume,
    slaCompliancePercent:
      r.resolvedCount > 0 ? Math.round((r.slaCompliantCount / r.resolvedCount) * 100) : 0,
  }));
}

export async function getCollegeComparison(monthsBack = 6) {
  const since = new Date();
  since.setMonth(since.getMonth() - monthsBack);

  const pipeline: PipelineStage[] = [
    {
      $lookup: {
        from: "users",
        localField: "studentRef",
        foreignField: "_id",
        as: "student",
      },
    },
    { $unwind: "$student" },
    {
      $lookup: {
        from: "offices",
        localField: "student.collegeRef",
        foreignField: "_id",
        as: "college",
      },
    },
    { $unwind: "$college" },
    { $match: { createdAt: { $gte: since }, isArchived: false } },
    {
      $group: {
        _id: "$college.name",
        volume: { $sum: 1 },
        avgRating: { $avg: "$studentRating" },
      },
    },
    { $sort: { volume: -1 } },
  ];

  const results = await Complaint.aggregate(pipeline);
  return results.map((r: any) => ({
    college: r._id,
    volume: r.volume,
    avgRating: r.avgRating ? Math.round(r.avgRating * 10) / 10 : null,
  }));
}
