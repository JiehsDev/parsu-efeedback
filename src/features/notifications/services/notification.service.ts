// src/features/notifications/services/notification.service.ts
import { connectToDatabase } from "@/lib/db";
import { Notification } from "@/models/Notification";
import { User } from "@/models/User";
import type { NotificationType } from "@/lib/constants";
import {
  sendComplaintSubmittedEmail,
  sendComplaintAssignedEmail,
  sendComplaintUpdatedEmail,
  sendComplaintResolvedEmail,
  sendSlaWarningEmail,
  sendEscalationEmail,
} from "./email.service";

async function getRecipient(userId: string) {
  const user = await User.findById(userId).select("email firstName lastName").lean();
  if (!user) return null;
  return {
    email: (user as any).email,
    name: `${(user as any).firstName} ${(user as any).lastName}`,
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
      });
    }
  }
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
    body: `Complaint ${params.ticketNumber} has been marked resolved. You can now rate the resolution.`,
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
    });
  }
}
