// src/app/student/feedback/new/page.tsx
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { Feedback } from "@/models/Feedback";
import { FeedbackForm } from "@/components/student/FeedbackForm";
import { FeedbackList } from "@/components/student/FeedbackList";

export default async function NewFeedbackPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  await connectToDatabase();

  // Read server-side like every other page in the app. The GET half of
  // /api/feedback returns exactly this, but no student page had ever called
  // it — so a student could not see anything they had sent.
  const recent = await Feedback.find({ studentRef: session!.user.id, isArchived: false })
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Link
        href="/student/dashboard"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to dashboard
      </Link>

      <div>
        <h1 className="text-xl font-semibold tracking-tight text-[var(--foreground)]">
          Share Feedback
        </h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          Suggestions and observations for the Quality Assurance office. Got a specific problem that
          needs fixing?{" "}
          <Link
            href="/student/complaints/new"
            className="text-[var(--primary)] underline underline-offset-2"
          >
            File a complaint instead
          </Link>
          .
        </p>
      </div>

      <FeedbackForm />

      {recent.length > 0 && <FeedbackList feedback={JSON.parse(JSON.stringify(recent))} />}
    </div>
  );
}
