import { Text, Button } from "react-email";
import * as React from "react";
import { EmailLayout } from "./components/EmailLayout";

export default function InformationRequested({
  recipientName,
  ticketNumber,
  requestMessage,
  complaintUrl,
}: {
  recipientName: string;
  ticketNumber: string;
  requestMessage: string;
  complaintUrl: string;
}) {
  return (
    <EmailLayout previewTitle="Additional Information Required">
      <Text>Hi {recipientName},</Text>
      <Text>
        Additional information is required for complaint <strong>{ticketNumber}</strong>.
      </Text>
      <Text>{requestMessage}</Text>
      <Button href={complaintUrl} style={{ background: "#2563eb", color: "#fff", padding: "10px 20px", borderRadius: "6px" }}>
        Submit Information
      </Button>
    </EmailLayout>
  );
}
