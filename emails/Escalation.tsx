// emails/Escalation.tsx
import { Text, Button } from "react-email";
import * as React from "react";
import { EmailLayout } from "./components/EmailLayout";

interface Props {
  recipientName: string;
  ticketNumber: string;
  complaintUrl: string;
}

export default function Escalation({ recipientName, ticketNumber, complaintUrl }: Props) {
  return (
    <EmailLayout previewTitle="Complaint Escalated">
      <Text>Hi {recipientName},</Text>
      <Text>
        Complaint <strong>{ticketNumber}</strong> has breached its SLA deadline and been escalated
        to your office for immediate attention.
      </Text>
      <Button
        href={complaintUrl}
        style={{ background: "#dc2626", color: "#fff", padding: "10px 20px", borderRadius: "6px" }}
      >
        View Complaint
      </Button>
    </EmailLayout>
  );
}
