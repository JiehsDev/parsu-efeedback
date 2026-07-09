// emails/ComplaintUpdated.tsx
import { Text, Button } from "react-email";
import * as React from "react";
import { EmailLayout } from "./components/EmailLayout";

interface Props {
  recipientName: string;
  ticketNumber: string;
  fromStatus: string;
  toStatus: string;
  complaintUrl: string;
}

export default function ComplaintUpdated({
  recipientName,
  ticketNumber,
  fromStatus,
  toStatus,
  complaintUrl,
}: Props) {
  return (
    <EmailLayout previewTitle="Complaint Status Updated">
      <Text>Hi {recipientName},</Text>
      <Text>
        Complaint <strong>{ticketNumber}</strong> changed from "{fromStatus}" to "{toStatus}".
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
