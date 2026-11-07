import { Button, Text } from "react-email";
import * as React from "react";
import { EmailLayout } from "./components/EmailLayout";

export default function EmailChangeConfirmation({
  recipientName,
  confirmationUrl,
}: {
  recipientName: string;
  confirmationUrl: string;
}) {
  return (
    <EmailLayout previewTitle="Confirm your email change">
      <Text>Hi {recipientName},</Text>
      <Text>
        Confirm that you want to use this email address for your ParSU e-Feedback account. This link
        expires in 30 minutes and can only be used once.
      </Text>
      <Button
        href={confirmationUrl}
        style={{ background: "#2563eb", color: "#fff", padding: "10px 20px", borderRadius: "6px" }}
      >
        Confirm email address
      </Button>
      <Text style={{ fontSize: "12px", color: "#9ca3af", marginTop: "16px" }}>
        If you did not request this change, ignore this email. Your account email will remain
        unchanged.
      </Text>
    </EmailLayout>
  );
}
