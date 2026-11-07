import type { Metadata } from "next";
import { EmailChangeConfirmation } from "./confirmation";

export const metadata: Metadata = {
  title: "Confirm email change | ParSU e-Feedback",
  referrer: "no-referrer",
};

export default async function EmailChangePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <EmailChangeConfirmation token={token} />;
}
