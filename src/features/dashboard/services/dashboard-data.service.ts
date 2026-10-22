import type { Session } from "next-auth";
import { Complaint } from "@/models/Complaint";
import { getAdminScope, complaintFilterForScope } from "@/lib/admin-scope";
import { staffComplaintFilter, isOversightRole } from "@/lib/osas-operations";
import {
  getAnalyticsSummary,
  getMonthlyTrends,
  getCategoryBreakdown,
  getPriorityBreakdown,
  getDomainBreakdown,
} from "@/features/analytics/services/analytics.service";

export async function getDashboardData(session: Session) {
  const filter =
    session.user.role === "office_staff"
      ? await staffComplaintFilter(session)
      : await complaintFilterForScope(getAdminScope(session.user.role));
  const open = {
    ...filter,
    isArchived: false,
    status: { $nin: ["closed", "resolved", "withdrawn"] as const },
  };
  const now = new Date();
  const nextDay = new Date(now.getTime() + 86400000);
  const [
    summary,
    trends,
    openCount,
    overdue,
    unassigned,
    dueSoon,
    queue,
    categories,
    priorities,
    domains,
  ] = await Promise.all([
    getAnalyticsSummary(filter),
    getMonthlyTrends(filter),
    Complaint.countDocuments(open),
    Complaint.countDocuments({
      ...open,
      $or: [
        { isOverdue: true },
        { assignedStaffRef: null, slaResponseDueAt: { $ne: null, $lte: now } },
        { assignedStaffRef: { $ne: null }, slaResolutionDueAt: { $ne: null, $lte: now } },
      ],
    }),
    Complaint.countDocuments({ ...open, assignedStaffRef: null }),
    Complaint.countDocuments({
      ...open,
      $or: [
        { assignedStaffRef: null, slaResponseDueAt: { $gt: now, $lte: nextDay } },
        { assignedStaffRef: { $ne: null }, slaResolutionDueAt: { $gt: now, $lte: nextDay } },
      ],
    }),
    Complaint.find(open)
      .sort({ isOverdue: -1, slaResolutionDueAt: 1, submittedAt: 1 })
      .limit(6)
      .select(
        "ticketNumber title status priority isOverdue assignedStaffRef slaResponseDueAt slaResolutionDueAt",
      )
      .lean(),
    getCategoryBreakdown({ ...filter, isArchived: false }),
    getPriorityBreakdown({ ...filter, isArchived: false }),
    getDomainBreakdown(filter),
  ]);
  return {
    summary,
    trends,
    openCount,
    overdue,
    unassigned,
    dueSoon,
    categories,
    priorities,
    domains,
    oversight: isOversightRole(session.user.role),
    role: session.user.role,
    queue: queue.map((complaint) => ({
      _id: String(complaint._id),
      ticketNumber: complaint.ticketNumber,
      title: complaint.title,
      status: complaint.status,
      isOverdue: complaint.isOverdue,
      assignedStaffRef: complaint.assignedStaffRef ? String(complaint.assignedStaffRef) : null,
      slaResponseDueAt: complaint.slaResponseDueAt?.toISOString() ?? null,
      slaResolutionDueAt: complaint.slaResolutionDueAt?.toISOString() ?? null,
    })),
  };
}
export type DashboardPayload = Awaited<ReturnType<typeof getDashboardData>>;
