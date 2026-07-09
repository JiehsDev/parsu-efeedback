// emails/components/EmailLayout.tsx
import { Html, Head, Body, Container, Text, Section, Heading } from "react-email";
import * as React from "react";

export function EmailLayout({
  previewTitle,
  children,
}: {
  previewTitle: string;
  children: React.ReactNode;
}) {
  return (
    <Html lang="en">
      <Head />
      <Body style={{ backgroundColor: "#f4f4f5", fontFamily: "sans-serif" }}>
        <Container
          style={{
            backgroundColor: "#ffffff",
            padding: "32px",
            borderRadius: "8px",
            maxWidth: "480px",
          }}
        >
          <Heading as="h2" style={{ fontSize: "18px", color: "#111827" }}>
            {previewTitle}
          </Heading>
          <Section>{children}</Section>
          <Text style={{ fontSize: "12px", color: "#9ca3af", marginTop: "24px" }}>
            ParSU e-Feedback System — this is an automated message.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
