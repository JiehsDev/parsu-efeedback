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
    <div className="w-full space-y-6">
      <Link
        href="/student/dashboard"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to dashboard
      </Link>

      <div>
        <h1 className="text-xl font-semibold tracking-tight text-[var(--foreground)]">
          Share feedback
        </h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          Have a suggestion or comment? For help with a specific issue,{" "}
          <Link
            href="/student/complaints/new"
            className="text-[var(--primary)] underline underline-offset-2"
          >
            File a complaint instead
          </Link>
          .
        </p>
      </div>

      <div className="grid min-w-0 grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(17rem,0.75fr)]">
        <FeedbackForm />

        <aside className="border-t border-[var(--border)] pt-5 xl:sticky xl:top-6 xl:border-t-0 xl:border-l xl:pl-6 xl:pt-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--primary)]">
            A useful note
          </p>
          <h2 className="mt-2 text-lg font-semibold tracking-tight text-[var(--foreground)]">
            Make your feedback specific
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-[var(--muted-foreground)]">
            A few concrete details help reviewers understand what happened and what could improve.
          </p>

          <ul className="mt-5 space-y-4 text-sm text-[var(--foreground)]">
            <li>
              <span className="block font-medium">Name the situation</span>
              <span className="mt-1 block leading-relaxed text-[var(--muted-foreground)]">
                Mention the service, class, or process you’re referring to.
              </span>
            </li>
            <li>
              <span className="block font-medium">Add useful context</span>
              <span className="mt-1 block leading-relaxed text-[var(--muted-foreground)]">
                Include when or where it happened, and what made it difficult.
              </span>
            </li>
            <li>
              <span className="block font-medium">Suggest a next step</span>
              <span className="mt-1 block leading-relaxed text-[var(--muted-foreground)]">
                If you have an idea, say what change would help.
              </span>
            </li>
          </ul>

          <p className="mt-5 border-t border-[var(--border)] pt-4 text-xs leading-relaxed text-[var(--muted-foreground)]">
            Avoid sharing passwords or sensitive personal details. For help with a specific problem, file a complaint so you can track its progress.
          </p>
        </aside>
      </div>

      {recent.length > 0 && <FeedbackList feedback={JSON.parse(JSON.stringify(recent))} />}
    </div>
  );
}
