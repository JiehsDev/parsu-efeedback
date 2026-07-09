// emails/ComplaintSubmitted.tsx
import { Text, Button } from "react-email";
import * as React from "react";
import { EmailLayout } from "./components/EmailLayout";

interface Props {
  recipientName: string;
  ticketNumber: string;
  complaintUrl: string;
}

export default function ComplaintSubmitted({ recipientName, ticketNumber, complaintUrl }: Props) {
  return (
    <EmailLayout previewTitle="Complaint Submitted">
      <Text>Hi {recipientName},</Text>
      <Text>
        Your complaint <strong>{ticketNumber}</strong> has been submitted and is being routed to the
        appropriate office.
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
