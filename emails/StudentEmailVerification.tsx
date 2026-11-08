import { Text } from "react-email";
import * as React from "react";
import { EmailLayout } from "./components/EmailLayout";

export default function StudentEmailVerification({
  recipientName,
  code,
}: {
  recipientName: string;
  code: string;
}) {
  return (
    <EmailLayout previewTitle="Verify your ParSU e-Feedback account">
      <Text>Hi {recipientName},</Text>
      <Text>Enter this code in ParSU e-Feedback to verify your student email address:</Text>
      <Text style={{ fontSize: "28px", fontWeight: "bold", letterSpacing: "8px" }}>{code}</Text>
      <Text>This code expires in 10 minutes and can only be used once.</Text>
      <Text style={{ fontSize: "12px", color: "#9ca3af", marginTop: "16px" }}>
        If you did not start this registration, you can ignore this email.
      </Text>
    </EmailLayout>
  );
}
