// src/app/student/feedback/new/page.tsx
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { Feedback } from "@/models/Feedback";
import { RelativeTime } from "@/components/shared/RelativeTime";
import { FeedbackForm } from "@/components/student/FeedbackForm";

export default async function NewFeedbackPage() {
  const session = await auth();
  await connectToDatabase();

  // Read server-side like every other page in the app. The GET half of
  // /api/feedback returns exactly this, but no student page had ever called
  // it — so a student could not see anything they had sent.
  const recent = await Feedback.find({ studentRef: session!.user.id })
    .sort({ createdAt: -1 })
    .limit(5)
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

      {recent.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)]">
          <h2 className="border-b border-[var(--border)] px-4 py-3 text-sm font-semibold text-[var(--foreground)]">
            Feedback you&rsquo;ve sent
          </h2>
          <ul className="divide-y divide-[var(--border)]">
            {recent.map((f) => (
              <li key={String(f._id)} className="px-4 py-3">
                <div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
                  <span className="font-medium text-[var(--foreground)]">{f.category}</span>
                  {f.isAnonymous && (
                    <span className="rounded bg-[var(--muted)] px-1.5 py-0.5 text-[11px]">
                      Anonymous
                    </span>
                  )}
                  <RelativeTime date={f.createdAt} className="qa-tabular ml-auto shrink-0" />
                </div>
                <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-[var(--muted-foreground)]">
                  {f.message}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
