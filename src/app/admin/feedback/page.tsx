// src/app/admin/feedback/page.tsx
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EyeOff, MessageSquareText, Tag, UserRound } from "lucide-react";
import { connectToDatabase } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getAdminScope, canAccessFeedback } from "@/lib/admin-scope";
import { Feedback } from "@/models/Feedback";
import { User } from "@/models/User";
import { FEEDBACK_CATEGORIES } from "@/features/feedback/constants";
import { ListSearchInput } from "@/components/shared/ListSearchInput";
import { escapeRegExp } from "@/lib/utils";

type SubmitterView = { name: string; email: string } | null;

// Anonymous feedback never has its studentRef resolved past this point —
// no name/email is looked up for those documents, so there is nothing to
// leak even by accident (not just a rendering choice).
async function resolveSubmitters(
  feedback: Array<{ _id: unknown; studentRef: unknown; isAnonymous: boolean }>,
): Promise<Map<string, SubmitterView>> {
  const identifiedIds = feedback.filter((f) => !f.isAnonymous).map((f) => String(f.studentRef));

  if (identifiedIds.length === 0) return new Map();

  const users = await User.find({ _id: { $in: identifiedIds } }, "firstName lastName email").lean();

  const map = new Map<string, SubmitterView>();
  for (const u of users) {
    map.set(String(u._id), { name: `${u.firstName} ${u.lastName}`, email: u.email });
  }
  return map;
}

export default async function AdminFeedbackPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; q?: string }>;
}) {
  // Feedback has no office/college link — it's entirely a student concern,
  // so only administrator and osas (students) get it; vpaa/vpaf don't, same
  // as they never see role=student Users.
  const session = await auth();
  const scope = getAdminScope(session!.user.role);
  if (!canAccessFeedback(scope)) notFound();

  await connectToDatabase();
  const { category, q } = await searchParams;
  const search = q?.trim();

  const filter: Record<string, unknown> = {};
  if (category) filter.category = category;
  if (search) filter.message = { $regex: escapeRegExp(search), $options: "i" };

  const feedback = await Feedback.find(filter).sort({ createdAt: -1 }).limit(200).lean();
  const submitters = await resolveSubmitters(feedback as any);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-[var(--foreground)]">
          Student Feedback
        </h1>
        <p className="mt-1.5 text-sm text-[var(--muted-foreground)]">
          General suggestions and observations, not tied to a specific complaint. {feedback.length}{" "}
          shown.
        </p>
      </div>

      <Suspense fallback={<div className="h-11 w-full max-w-xs" />}>
        <ListSearchInput placeholder="Search feedback text…" className="max-w-xs" />
      </Suspense>

      <div className="flex flex-wrap items-center gap-0.5 rounded-full bg-[var(--muted)]/50 p-1">
        {[
          { value: "", label: "All Categories" },
          ...FEEDBACK_CATEGORIES.map((c) => ({ value: c, label: c })),
        ].map((f) => {
          const params = new URLSearchParams();
          if (f.value) params.set("category", f.value);
          if (search) params.set("q", search);
          const href = params.toString() ? `/admin/feedback?${params}` : "/admin/feedback";

          return (
            <Link
              key={f.value}
              href={href}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition-all ${
                (category ?? "") === f.value
                  ? "bg-[var(--card)] text-[var(--foreground)] shadow-sm ring-1 ring-[var(--border)]"
                  : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              }`}
            >
              {f.label}
            </Link>
          );
        })}
      </div>

      {feedback.length === 0 ? (
        <div className="flex flex-col items-center rounded-3xl border border-dashed border-[var(--border)] bg-[var(--card)] px-8 py-14 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--muted)] text-[var(--muted-foreground)]">
            <MessageSquareText className="h-6 w-6" />
          </span>
          <p className="mt-4 text-sm font-medium text-[var(--foreground)]">
            No feedback matches this filter.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {feedback.map((f: any) => {
            const submitter = f.isAnonymous ? null : (submitters.get(String(f.studentRef)) ?? null);
            return (
              <li
                key={f._id}
                className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--primary)]/10 px-2.5 py-1 text-xs font-medium text-[var(--primary)]">
                    <Tag className="h-3 w-3" />
                    {f.category}
                  </span>
                  <span className="text-xs text-[var(--muted-foreground)]">
                    {new Date(f.createdAt).toLocaleString()}
                  </span>
                </div>

                <p className="mt-3 text-sm leading-relaxed text-[var(--foreground)]">{f.message}</p>

                <div className="mt-3 flex items-center gap-1.5 text-xs text-[var(--muted-foreground)]">
                  {submitter ? (
                    <>
                      <UserRound className="h-3.5 w-3.5" />
                      {submitter.name} · {submitter.email}
                    </>
                  ) : (
                    <>
                      <EyeOff className="h-3.5 w-3.5" />
                      Anonymous submission
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
