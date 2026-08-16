import { render } from "react-email";
import { resend } from "@/lib/resend";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import ComplaintSubmitted from "../../../../emails/ComplaintSubmitted";
import ComplaintAssigned from "../../../../emails/ComplaintAssigned";
import ComplaintUpdated from "../../../../emails/ComplaintUpdated";
import ComplaintResolved from "../../../../emails/ComplaintResolved";
import SLAWarning from "../../../../emails/SLAWarning";
import Escalation from "../../../../emails/Escalation";
import PasswordReset from "../../../../emails/PasswordReset";

export async function sendPasswordResetEmail(params: {
  to: string;
  recipientName: string;
  resetToken: string;
}) {
  const resetUrl = `${env.NEXT_PUBLIC_APP_URL}/reset-password/${params.resetToken}`;
  await sendEmail(
    params.to,
    "Reset your ParSU e-Feedback password",
    PasswordReset({ recipientName: params.recipientName, resetUrl }),
  );
}
async function sendEmail(to: string, subject: string, react: React.ReactElement) {
  // Without a verified domain, Resend only delivers to the account's own
  // signup email. Redirect there in dev/test so the pipeline is still
  // exercised honestly, without needing real inboxes for seeded accounts.
  const actualRecipient = env.NODE_ENV === "production" ? to : env.RESEND_DEV_TEST_EMAIL;

  const actualSubject = env.NODE_ENV === "production" ? subject : `[would go to ${to}] ${subject}`;

  try {
    const html = await render(react);
    await resend.emails.send({
      from: env.RESEND_FROM_EMAIL,
      to: actualRecipient,
      subject: actualSubject,
      html,
    });
  } catch (error) {
    logger.error("Failed to send email", {
      to: actualRecipient,
      intendedRecipient: to,
      subject,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

function complaintUrl(complaintId: string) {
  return `${env.NEXT_PUBLIC_APP_URL}/complaints/${complaintId}`;
}

export async function sendComplaintSubmittedEmail(params: {
  to: string;
  recipientName: string;
  ticketNumber: string;
  complaintId: string;
}) {
  await sendEmail(
    params.to,
    `Complaint ${params.ticketNumber} submitted`,
    ComplaintSubmitted({
      recipientName: params.recipientName,
      ticketNumber: params.ticketNumber,
      complaintUrl: complaintUrl(params.complaintId),
    }),
  );
}

export async function sendComplaintAssignedEmail(params: {
  to: string;
  recipientName: string;
  ticketNumber: string;
  complaintId: string;
  isStaffRecipient: boolean;
}) {
  await sendEmail(
    params.to,
    `Complaint ${params.ticketNumber} assigned`,
    ComplaintAssigned({
      recipientName: params.recipientName,
      ticketNumber: params.ticketNumber,
      complaintUrl: complaintUrl(params.complaintId),
      isStaffRecipient: params.isStaffRecipient,
    }),
  );
}

export async function sendComplaintUpdatedEmail(params: {
  to: string;
  recipientName: string;
  ticketNumber: string;
  complaintId: string;
  fromStatus: string;
  toStatus: string;
}) {
  await sendEmail(
    params.to,
    `Complaint ${params.ticketNumber} status updated`,
    ComplaintUpdated({
      recipientName: params.recipientName,
      ticketNumber: params.ticketNumber,
      fromStatus: params.fromStatus,
      toStatus: params.toStatus,
      complaintUrl: complaintUrl(params.complaintId),
    }),
  );
}

export async function sendComplaintResolvedEmail(params: {
  to: string;
  recipientName: string;
  ticketNumber: string;
  complaintId: string;
}) {
  await sendEmail(
    params.to,
    `Complaint ${params.ticketNumber} resolved`,
    ComplaintResolved({
      recipientName: params.recipientName,
      ticketNumber: params.ticketNumber,
      complaintUrl: complaintUrl(params.complaintId),
    }),
  );
}

export async function sendSlaWarningEmail(params: {
  to: string;
  recipientName: string;
  ticketNumber: string;
  complaintId: string;
  warningThresholdPercent: number;
}) {
  await sendEmail(
    params.to,
    `SLA warning — complaint ${params.ticketNumber}`,
    SLAWarning({
      recipientName: params.recipientName,
      ticketNumber: params.ticketNumber,
      complaintUrl: complaintUrl(params.complaintId),
      warningThresholdPercent: params.warningThresholdPercent,
    }),
  );
}

export async function sendEscalationEmail(params: {
  to: string;
  recipientName: string;
  ticketNumber: string;
  complaintId: string;
}) {
  await sendEmail(
    params.to,
    `Complaint ${params.ticketNumber} escalated`,
    Escalation({
      recipientName: params.recipientName,
      ticketNumber: params.ticketNumber,
      complaintUrl: complaintUrl(params.complaintId),
    }),
  );
}
