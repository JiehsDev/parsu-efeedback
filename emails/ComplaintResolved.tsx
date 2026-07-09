// emails/ComplaintResolved.tsx
import { Text, Button } from "react-email";
import * as React from "react";
import { EmailLayout } from "./components/EmailLayout";

interface Props {
  recipientName: string;
  ticketNumber: string;
  complaintUrl: string;
}

export default function ComplaintResolved({ recipientName, ticketNumber, complaintUrl }: Props) {
  return (
    <EmailLayout previewTitle="Complaint Resolved">
      <Text>Hi {recipientName},</Text>
      <Text>
        Complaint <strong>{ticketNumber}</strong> has been marked resolved. Please take a moment to
        rate the resolution.
      </Text>
      <Button
        href={complaintUrl}
        style={{ background: "#16a34a", color: "#fff", padding: "10px 20px", borderRadius: "6px" }}
      >
        Rate Resolution
      </Button>
    </EmailLayout>
  );
}
