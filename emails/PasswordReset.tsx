// emails/PasswordReset.tsx
import { Text, Button } from "react-email";
import * as React from "react";
import { EmailLayout } from "./components/EmailLayout";

interface Props {
  recipientName: string;
  resetUrl: string;
}

export default function PasswordReset({ recipientName, resetUrl }: Props) {
  return (
    <EmailLayout previewTitle="Reset Your Password">
      <Text>Hi {recipientName},</Text>
      <Text>
        We received a request to reset your ParSU e-Feedback password. This link expires in 30
        minutes and can only be used once.
      </Text>
      <Button
        href={resetUrl}
        style={{ background: "#2563eb", color: "#fff", padding: "10px 20px", borderRadius: "6px" }}
      >
        Reset Password
      </Button>
      <Text style={{ fontSize: "12px", color: "#9ca3af", marginTop: "16px" }}>
        If you didn't request this, you can safely ignore this email — your password will not be
        changed.
      </Text>
    </EmailLayout>
  );
}
