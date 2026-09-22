// src/features/notifications/services/notification.service.ts
import { connectToDatabase } from "@/lib/db";
import { Notification } from "@/models/Notification";
import { User } from "@/models/User";
import { Office } from "@/models/Office";
import type { NotificationType } from "@/lib/constants";
import {
  sendComplaintSubmittedEmail,
  sendComplaintAssignedEmail,
  sendComplaintUpdatedEmail,
  sendComplaintResolvedEmail,
  sendSlaWarningEmail,
  sendEscalationEmail,
  sendInformationRequestedEmail,
  sendInformationSubmittedEmail,
} from "./email.service";

async function getRecipient(userId: string) {
  const user = await User.findById(userId).select("email firstName lastName role").lean();
  if (!user) return null;
  return {
    email: (user as any).email,
    name: `${(user as any).firstName} ${(user as any).lastName}`,
    role: (user as any).role,
  };
}

interface CreateNotificationParams {
  userRef: string;
  type: NotificationType;
  title: string;
  body: string;
  relatedComplaintRef?: string | null;
}

async function createNotification(params: CreateNotificationParams): Promise<void> {
  await connectToDatabase();
  await Notification.create({
    userRef: params.userRef,
    type: params.type,
    title: params.title,
    body: params.body,
    relatedComplaintRef: params.relatedComplaintRef ?? null,
  });
}

export async function notifyComplaintSubmitted(params: {
  studentId: string;
  ticketNumber: string;
  complaintId: string;
}) {
  await createNotification({
    userRef: params.studentId,
    type: "complaint_submitted",
    title: "Complaint submitted",
    body: `Your complaint ${params.ticketNumber} has been submitted and is being routed.`,
    relatedComplaintRef: params.complaintId,
  });

  const recipient = await getRecipient(params.studentId);
  if (recipient) {
    await sendComplaintSubmittedEmail({
      to: recipient.email,
      recipientName: recipient.name,
      ticketNumber: params.ticketNumber,
      complaintId: params.complaintId,
    });
  }
}

export async function notifyComplaintAssigned(params: {
  studentId: string;
  staffId?: string | null;
  ticketNumber: string;
  complaintId: string;
}) {
  await createNotification({
    userRef: params.studentId,
    type: "complaint_assigned",
    title: "Complaint assigned",
    body: `Your complaint ${params.ticketNumber} has been assigned to an office for handling.`,
    relatedComplaintRef: params.complaintId,
  });

  const student = await getRecipient(params.studentId);
  if (student) {
    await sendComplaintAssignedEmail({
      to: student.email,
      recipientName: student.name,
      ticketNumber: params.ticketNumber,
      complaintId: params.complaintId,
      isStaffRecipient: false,
    });
  }

  if (params.staffId) {
    await createNotification({
      userRef: params.staffId,
      type: "complaint_assigned",
      title: "New complaint assigned to you",
      body: `Complaint ${params.ticketNumber} has been assigned to you.`,
      relatedComplaintRef: params.complaintId,
    });

    const staff = await getRecipient(params.staffId);
    if (staff) {
      await sendComplaintAssignedEmail({
        to: staff.email,
        recipientName: staff.name,
        ticketNumber: params.ticketNumber,
        complaintId: params.complaintId,
        isStaffRecipient: true,
        recipientRole: staff.role,
      });
    }
  }
}

export async function notifyComplaintRoutedToOffice(params: {
  officeId: string;
  ticketNumber: string;
  complaintId: string;
}) {
  await connectToDatabase();

  const office = await Office.findById(params.officeId).select("name headUserRef").lean();
  const staff = await User.find({
    role: "office_staff",
    officeRef: params.officeId,
    isActive: true,
  })
    .select("_id")
    .lean();

  const recipientIds = new Set(staff.map((member: any) => String(member._id)));
  if ((office as any)?.headUserRef) recipientIds.add(String((office as any).headUserRef));

  await Promise.all(
    [...recipientIds].map(async (userId) => {
      await createNotification({
        userRef: userId,
        type: "complaint_assigned",
        title: "New complaint routed to your office",
        body: `Complaint ${params.ticketNumber} has been routed to ${(office as any)?.name ?? "your office"}.`,
        relatedComplaintRef: params.complaintId,
      });

      const recipient = await getRecipient(userId);
      if (recipient) {
        await sendComplaintAssignedEmail({
          to: recipient.email,
          recipientName: recipient.name,
          ticketNumber: params.ticketNumber,
          complaintId: params.complaintId,
          isStaffRecipient: true,
          recipientRole: recipient.role,
        });
      }
    }),
  );
}

export async function notifyComplaintClosedByStudent(params: {
  complaintId: string;
  ticketNumber: string;
  officeId: string | null;
  assignedStaffId: string | null;
  closureType: "rated" | "without_rating";
  rating?: number;
}) {
  await connectToDatabase();

  const recipientIds = new Set<string>();
  if (params.assignedStaffId) recipientIds.add(params.assignedStaffId);
  if (params.officeId) {
    const office = await Office.findById(params.officeId).select("headUserRef").lean();
    if ((office as any)?.headUserRef) recipientIds.add(String((office as any).headUserRef));
  }
  if (recipientIds.size === 0) return;

  const body =
    params.closureType === "rated"
      ? `Complaint ${params.ticketNumber} was closed by the student with a rating of ${params.rating}/5.`
      : `Complaint ${params.ticketNumber} was closed by the student without submitting a rating.`;

  await Promise.all(
    [...recipientIds].map((userId) =>
      createNotification({
        userRef: userId,
        type: "status_updated",
        title: "Complaint closed by student",
        body,
        relatedComplaintRef: params.complaintId,
      }),
    ),
  );
}

export async function notifyStatusUpdated(params: {
  studentId: string;
  ticketNumber: string;
  complaintId: string;
  fromStatus: string;
  toStatus: string;
}) {
  await createNotification({
    userRef: params.studentId,
    type: "status_updated",
    title: "Complaint status updated",
    body: `Complaint ${params.ticketNumber} changed from "${params.fromStatus}" to "${params.toStatus}".`,
    relatedComplaintRef: params.complaintId,
  });

  const recipient = await getRecipient(params.studentId);
  if (recipient) {
    await sendComplaintUpdatedEmail({
      to: recipient.email,
      recipientName: recipient.name,
      ticketNumber: params.ticketNumber,
      complaintId: params.complaintId,
      fromStatus: params.fromStatus,
      toStatus: params.toStatus,
    });
  }
}

export async function notifyComplaintResolved(params: {
  studentId: string;
  ticketNumber: string;
  complaintId: string;
}) {
  await createNotification({
    userRef: params.studentId,
    type: "complaint_resolved",
    title: "Complaint resolved",
    body: `Complaint ${params.ticketNumber} has been resolved. You may review the resolution, submit a rating, or close the complaint without rating.`,
    relatedComplaintRef: params.complaintId,
  });

  const recipient = await getRecipient(params.studentId);
  if (recipient) {
    await sendComplaintResolvedEmail({
      to: recipient.email,
      recipientName: recipient.name,
      ticketNumber: params.ticketNumber,
      complaintId: params.complaintId,
    });
  }
}

export async function notifyComplaintReopened(params: {
  studentId: string;
  staffId?: string | null;
  officeId?: string | null;
  ticketNumber: string;
  complaintId: string;
}) {
  const recipientIds = new Set<string>([params.studentId]);
  if (params.staffId) recipientIds.add(params.staffId);
  if (params.officeId) {
    const office = await Office.findById(params.officeId).select("headUserRef").lean();
    if ((office as any)?.headUserRef) recipientIds.add(String((office as any).headUserRef));
  }

  await Promise.all(
    [...recipientIds].map((userId) =>
      createNotification({
        userRef: userId,
        type: "status_updated",
        title: "Complaint reopened",
        body: `Complaint ${params.ticketNumber} has been reopened for further handling.`,
        relatedComplaintRef: params.complaintId,
      }),
    ),
  );
}

export async function notifySlaWarning(params: {
  staffId?: string | null;
  ticketNumber: string;
  complaintId: string;
  warningThresholdPercent: number;
}) {
  if (!params.staffId) return;

  await createNotification({
    userRef: params.staffId,
    type: "sla_warning",
    title: "SLA deadline approaching",
    body: `Complaint ${params.ticketNumber} is approaching its SLA deadline (${params.warningThresholdPercent}% elapsed).`,
    relatedComplaintRef: params.complaintId,
  });

  const recipient = await getRecipient(params.staffId);
  if (recipient) {
    await sendSlaWarningEmail({
      to: recipient.email,
      recipientName: recipient.name,
      ticketNumber: params.ticketNumber,
      complaintId: params.complaintId,
      warningThresholdPercent: params.warningThresholdPercent,
    });
  }
}

export async function notifyEscalation(params: {
  staffId?: string | null;
  ticketNumber: string;
  complaintId: string;
}) {
  if (!params.staffId) return;

  await createNotification({
    userRef: params.staffId,
    type: "escalation",
    title: "Complaint escalated to you",
    body: `Complaint ${params.ticketNumber} has breached its SLA and been escalated to you.`,
    relatedComplaintRef: params.complaintId,
  });

  const recipient = await getRecipient(params.staffId);
  if (recipient) {
    await sendEscalationEmail({
      to: recipient.email,
      recipientName: recipient.name,
      ticketNumber: params.ticketNumber,
      complaintId: params.complaintId,
      recipientRole: recipient.role,
    });
  }
}

export async function notifyManualEscalation(params: {
  studentId: string;
  staffId: string;
  ticketNumber: string;
  complaintId: string;
  reason: string;
  fromStatus: string;
}) {
  await createNotification({
    userRef: params.staffId,
    type: "escalation",
    title: "Complaint manually escalated to you",
    body: `Complaint ${params.ticketNumber} was escalated to you. Reason: ${params.reason}`,
    relatedComplaintRef: params.complaintId,
  });
  const recipient = await getRecipient(params.staffId);
  if (recipient) {
    await sendEscalationEmail({
      to: recipient.email,
      recipientName: recipient.name,
      ticketNumber: params.ticketNumber,
      complaintId: params.complaintId,
      manual: true,
      recipientRole: recipient.role,
    });
  }
  await createNotification({
    userRef: params.studentId,
    type: "status_updated",
    title: "Complaint escalated",
    body: `Complaint ${params.ticketNumber} was escalated for higher-level review.`,
    relatedComplaintRef: params.complaintId,
  });
  const student = await getRecipient(params.studentId);
  if (student) {
    await sendComplaintUpdatedEmail({
      to: student.email,
      recipientName: student.name,
      ticketNumber: params.ticketNumber,
      complaintId: params.complaintId,
      fromStatus: params.fromStatus,
      toStatus: "escalated",
    });
  }
}

export async function notifyOfficeReassignment(params: {
  studentId: string;
  ticketNumber: string;
  complaintId: string;
  destinationOfficeId: string;
  destinationOfficeName: string;
  previousStaffId?: string | null;
}) {
  // Destination office (staff + head) — reuse the existing "routed to
  // office" fan-out so the new office sees it the same way a fresh
  // routing would.
  await notifyComplaintRoutedToOffice({
    officeId: params.destinationOfficeId,
    ticketNumber: params.ticketNumber,
    complaintId: params.complaintId,
  });

  if (params.previousStaffId) {
    await createNotification({
      userRef: params.previousStaffId,
      type: "status_updated",
      title: "Complaint reassigned to another office",
      body: `Complaint ${params.ticketNumber} was transferred to ${params.destinationOfficeName}. It is no longer assigned to you.`,
      relatedComplaintRef: params.complaintId,
    });
  }

  // Student notice is intentionally generic — the internal reassignment
  // reason isn't exposed to the student.
  await createNotification({
    userRef: params.studentId,
    type: "status_updated",
    title: "Complaint routed to another office",
    body: `Your complaint ${params.ticketNumber} has been routed to the office responsible for handling your concern.`,
    relatedComplaintRef: params.complaintId,
  });
}

export async function notifyInformationRequested(params: {
  studentId: string;
  ticketNumber: string;
  complaintId: string;
  requestMessage: string;
}) {
  await createNotification({
    userRef: params.studentId,
    type: "status_updated",
    title: "Additional information requested",
    body: `Additional information is required for complaint ${params.ticketNumber}.`,
    relatedComplaintRef: params.complaintId,
  });
  const recipient = await getRecipient(params.studentId);
  if (recipient) {
    await sendInformationRequestedEmail({
      to: recipient.email,
      recipientName: recipient.name,
      ticketNumber: params.ticketNumber,
      requestMessage: params.requestMessage,
      complaintId: params.complaintId,
    });
  }
}

export async function notifyInformationSubmitted(params: {
  staffIds: string[];
  ticketNumber: string;
  complaintId: string;
}) {
  await Promise.all(
    [...new Set(params.staffIds)].map(async (staffId) => {
      await createNotification({
        userRef: staffId,
        type: "status_updated",
        title: "Additional information submitted",
        body: `The student submitted additional information for complaint ${params.ticketNumber}.`,
        relatedComplaintRef: params.complaintId,
      });
      const recipient = await getRecipient(staffId);
      if (recipient) {
        await sendInformationSubmittedEmail({
          to: recipient.email,
          recipientName: recipient.name,
          ticketNumber: params.ticketNumber,
          complaintId: params.complaintId,
        });
      }
    }),
  );
}

export async function notifyArchiveRequested(params: { userId: string; ticketNumber: string; complaintId: string; requestId: string; reason: string; complaintTitle?: string; requesterName?: string }) {
  const requester = params.requesterName ? ` from ${params.requesterName}` : "";
  const title = params.complaintTitle ? ` (${params.complaintTitle})` : "";
  await createNotification({ userRef: params.userId, type: "archive_request", title: "Archive request needs review", body: `Archive request${requester} for ${params.ticketNumber}${title}: ${params.reason}`, relatedComplaintRef: params.complaintId });
}

export async function notifyArchiveDecision(params: { userId: string; approved: boolean; ticketNumber: string; complaintId: string; reason?: string }) {
  await createNotification({ userRef: params.userId, type: "archive_decision", title: params.approved ? "Archive request approved" : "Archive request rejected", body: params.approved ? `Archive request for ${params.ticketNumber} was approved.` : `Archive request for ${params.ticketNumber} was rejected${params.reason ? `: ${params.reason}` : "."}`, relatedComplaintRef: params.complaintId });
}

export async function notifyComplaintRestored(params: { studentId: string; ticketNumber: string; complaintId: string }) {
  await createNotification({ userRef: params.studentId, type: "complaint_restored", title: "Complaint restored", body: `Complaint ${params.ticketNumber} has been restored for continued handling.`, relatedComplaintRef: params.complaintId });
}
