import { Text } from "react-email";
import * as React from "react";
import { EmailLayout } from "./components/EmailLayout";

export default function EmailChangedNotice({
  recipientName,
  newEmail,
}: {
  recipientName: string;
  newEmail: string;
}) {
  return (
    <EmailLayout previewTitle="Your account email was changed">
      <Text>Hi {recipientName},</Text>
      <Text>The email address for your ParSU e-Feedback account was changed to {newEmail}.</Text>
      <Text style={{ fontSize: "12px", color: "#9ca3af", marginTop: "16px" }}>
        If you did not make this change, contact your system administrator immediately.
      </Text>
    </EmailLayout>
  );
}
