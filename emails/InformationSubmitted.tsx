import { Text, Button } from "react-email";
import * as React from "react";
import { EmailLayout } from "./components/EmailLayout";

export default function InformationSubmitted({
  recipientName,
  ticketNumber,
  complaintUrl,
}: {
  recipientName: string;
  ticketNumber: string;
  complaintUrl: string;
}) {
  return (
    <EmailLayout previewTitle="Additional Information Submitted">
      <Text>Hi {recipientName},</Text>
      <Text>
        Additional information has been submitted for complaint <strong>{ticketNumber}</strong>.
        The complaint is back in progress.
      </Text>
      <Button href={complaintUrl} style={{ background: "#2563eb", color: "#fff", padding: "10px 20px", borderRadius: "6px" }}>
        Review Complaint
      </Button>
    </EmailLayout>
  );
}
