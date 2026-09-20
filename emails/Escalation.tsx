// emails/Escalation.tsx
import { Text, Button } from "react-email";
import * as React from "react";
import { EmailLayout } from "./components/EmailLayout";

interface Props {
  recipientName: string;
  ticketNumber: string;
  complaintUrl: string;
  manual?: boolean;
}

export default function Escalation({ recipientName, ticketNumber, complaintUrl, manual }: Props) {
  return (
    <EmailLayout previewTitle="Complaint Escalated">
      <Text>Hi {recipientName},</Text>
      <Text>
        Complaint <strong>{ticketNumber}</strong>{" "}
        {manual
          ? "has been manually escalated to you for immediate attention."
          : "has breached its SLA deadline and been escalated to you for immediate attention."}
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
