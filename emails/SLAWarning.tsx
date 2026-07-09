// emails/SLAWarning.tsx
import { Text, Button } from "react-email";
import * as React from "react";
import { EmailLayout } from "./components/EmailLayout";

interface Props {
  recipientName: string;
  ticketNumber: string;
  warningThresholdPercent: number;
  complaintUrl: string;
}

export default function SLAWarning({
  recipientName,
  ticketNumber,
  warningThresholdPercent,
  complaintUrl,
}: Props) {
  return (
    <EmailLayout previewTitle="SLA Deadline Approaching">
      <Text>Hi {recipientName},</Text>
      <Text>
        Complaint <strong>{ticketNumber}</strong> is approaching its SLA resolution deadline (
        {warningThresholdPercent}% of the allotted time has elapsed).
      </Text>
      <Button
        href={complaintUrl}
        style={{ background: "#d97706", color: "#fff", padding: "10px 20px", borderRadius: "6px" }}
      >
        Review Now
      </Button>
    </EmailLayout>
  );
}
