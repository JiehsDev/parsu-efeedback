import { Text, Button } from "react-email";
import * as React from "react";
import { EmailLayout } from "./components/EmailLayout";

export default function ComplaintDismissed({
  recipientName,
  ticketNumber,
  reason,
  complaintUrl,
}: {
  recipientName: string;
  ticketNumber: string;
  reason: string;
  complaintUrl: string;
}) {
  return (
    <EmailLayout previewTitle="Complaint dismissed">
      <Text>Hi {recipientName},</Text>
      <Text>Your complaint {ticketNumber} was dismissed after review.</Text>
      <Text>Reason: {reason}</Text>
      <Button
        href={complaintUrl}
        style={{ background: "#2563eb", color: "#fff", padding: "10px 20px", borderRadius: "6px" }}
      >
        View Complaint
      </Button>
    </EmailLayout>
  );
}
