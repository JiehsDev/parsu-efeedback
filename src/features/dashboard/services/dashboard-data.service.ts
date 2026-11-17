import { ForwardingRequest } from "@/models/ForwardingRequest";
import type { Session } from "next-auth";
import { Complaint } from "@/models/Complaint";
import { getAdminScope, complaintFilterForScope } from "@/lib/admin-scope";
import {
  staffComplaintFilter,
  isOsasHead,
  getOperationalOffice,
  getStaffOffice,
} from "@/lib/osas-operations";
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
  const open: Record<string, unknown> = {
    ...filter,
    isArchived: false,
    status: { $nin: ["closed", "resolved", "withdrawn"] as const },
  };
  const now = new Date();
  const nextDay = new Date(now.getTime() + 86400000);
  const awaitingFirstResponse = {
    status: { $in: ["submitted", "assigned"] },
    firstResponseAt: null,
  };
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
        { ...awaitingFirstResponse, slaResponseDueAt: { $ne: null, $lte: now } },
        { $nor: [awaitingFirstResponse], slaResolutionDueAt: { $ne: null, $lte: now } },
      ],
    } as any),
    Complaint.countDocuments({ ...open, assignedStaffRef: null }),
    Complaint.countDocuments({
      ...open,
      $or: [
        { ...awaitingFirstResponse, slaResponseDueAt: { $gt: now, $lte: nextDay } },
        { $nor: [awaitingFirstResponse], slaResolutionDueAt: { $gt: now, $lte: nextDay } },
      ],
    } as any),
    Complaint.find(open)
      .sort({ isOverdue: -1, slaResolutionDueAt: 1, submittedAt: 1 })
      .limit(6)
      .select(
        "ticketNumber title status priority isOverdue assignedStaffRef firstResponseAt slaResponseDueAt slaResolutionDueAt",
      )
      .lean(),
    getCategoryBreakdown({ ...filter, isArchived: false }),
    getPriorityBreakdown({ ...filter, isArchived: false }),
    getDomainBreakdown(filter),
  ]);
  const osas = await getOperationalOffice();
  const head = await isOsasHead(session);
  const staffOffice = await getStaffOffice(session);
  const showForwarding = staffOffice?.code === "OSAS";
  const forwardingStats =
    showForwarding && osas
      ? {
          pending: await ForwardingRequest.countDocuments({
            fromOfficeRef: osas._id,
            status: "pending",
            ...(!head ? { requestedByUserRef: session.user.id } : {}),
          }),
          vpaa: await ForwardingRequest.countDocuments({
            fromOfficeRef: osas._id,
            status: "approved",
            requestedDestination: "vpaa",
          }),
          vpaf: await ForwardingRequest.countDocuments({
            fromOfficeRef: osas._id,
            status: "approved",
            requestedDestination: "vpaf",
          }),
        }
      : null;
  return {
    forwardingStats,
    receivingOffice:
      ["vpaa", "vpaf"].includes(session.user.role) ||
      ["OVPAA", "OVPAF"].includes(staffOffice?.code ?? ""),
    summary,
    trends,
    openCount,
    overdue,
    unassigned,
    dueSoon,
    categories,
    priorities,
    domains,
    oversight: false,
    role: session.user.role,
    queue: queue.map((complaint) => ({
      _id: String(complaint._id),
      ticketNumber: complaint.ticketNumber,
      title: complaint.title,
      status: complaint.status,
      isOverdue: complaint.isOverdue,
      assignedStaffRef: complaint.assignedStaffRef ? String(complaint.assignedStaffRef) : null,
      firstResponseAt: complaint.firstResponseAt?.toISOString() ?? null,
      slaResponseDueAt: complaint.slaResponseDueAt?.toISOString() ?? null,
      slaResolutionDueAt: complaint.slaResolutionDueAt?.toISOString() ?? null,
    })),
  };
}
export type DashboardPayload = Awaited<ReturnType<typeof getDashboardData>>;
