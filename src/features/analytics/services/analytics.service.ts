// src/features/analytics/services/analytics.service.ts
import { Complaint } from "@/models/Complaint";
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

// BR-089 "Category Distribution" — scoped by the same flat $match pattern
// as getMonthlyTrends, so dean/qa/admin all reuse this with their own
// pre-resolved scopeMatch.
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
