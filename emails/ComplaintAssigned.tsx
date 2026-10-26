// emails/ComplaintAssigned.tsx
import { Text, Button } from "react-email";
import * as React from "react";
import { EmailLayout } from "./components/EmailLayout";

interface Props {
  recipientName: string;
  ticketNumber: string;
  complaintUrl: string;
  isStaffRecipient: boolean;
}

export default function ComplaintAssigned({
  recipientName,
  ticketNumber,
  complaintUrl,
  isStaffRecipient,
}: Props) {
  return (
    <EmailLayout previewTitle={isStaffRecipient ? "Complaint Assigned" : "Complaint Under Review"}>
      <Text>Hi {recipientName},</Text>
      <Text>
        {isStaffRecipient
          ? `Complaint ${ticketNumber} has been assigned to you for handling.`
          : `Your complaint ${ticketNumber} is now under review.`}
      </Text>
      <Button
        href={complaintUrl}
        style={{ background: "#2563eb", color: "#fff", padding: "10px 20px", borderRadius: "6px" }}
      >
        View Complaint
      </Button>
    </EmailLayout>
  );
}
