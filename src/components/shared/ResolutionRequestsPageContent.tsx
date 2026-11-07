import Link from "next/link";
import { redirect } from "next/navigation";
import { ClipboardCheck } from "lucide-react";
import { auth } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import {
  isResolutionRequestHead,
  listPendingResolutionRequestsForHead,
} from "@/features/complaints/services/resolution-request-query.service";

interface ResolutionRequestListItem {
  _id: string;
  createdAt: string;
  resolutionSummary: string;
  complaintRef: { _id: string; ticketNumber: string; title: string; status: string } | null;
  requestedByRef: { firstName: string; lastName: string } | null;
}

export async function ResolutionRequestsPageContent({ base }: { base: "admin" | "staff" }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (base === "admin" && !["osas", "vpaa", "vpaf"].includes(session.user.role)) {
    redirect("/dashboard");
  }
  if (base === "staff" && session.user.role !== "office_staff") {
    redirect("/dashboard");
  }

  await connectToDatabase();
  if (!(await isResolutionRequestHead(session.user))) {
    redirect(base === "admin" ? "/admin/dashboard" : "/staff/dashboard");
  }

  const requests = await listPendingResolutionRequestsForHead(session.user);
  const displayRequests = JSON.parse(JSON.stringify(requests)) as ResolutionRequestListItem[];
  const complaintPath = base === "admin" ? "/admin/complaints" : "/staff/complaints";

  return (
    <div className="workspace-page space-y-6">
      <header>
        <p className="text-xs font-semibold tracking-wide text-[var(--primary)] uppercase">
          Office Head Review
        </p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-[var(--foreground)]">
          Resolution Requests
        </h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          Review resolution requests submitted by staff in your office.
        </p>
      </header>

      {displayRequests.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--card)] px-6 py-14 text-center">
          <ClipboardCheck className="mx-auto h-8 w-8 text-[var(--muted-foreground)]" />
          <p className="mt-3 text-sm font-medium">No pending resolution requests</p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayRequests.map((request) => (
            <article
              key={String(request._id)}
              className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4"
            >
              <Link
                href={`${complaintPath}/${request.complaintRef?._id}`}
                className="font-mono text-xs text-[var(--primary)] hover:underline"
              >
                {request.complaintRef?.ticketNumber ?? "Complaint"}
              </Link>
              <h2 className="mt-1 text-base font-semibold text-[var(--foreground)]">
                {request.complaintRef?.title ?? "Complaint details unavailable"}
              </h2>
              <p className="mt-2 text-sm text-[var(--muted-foreground)]">
                Requested by {request.requestedByRef?.firstName} {request.requestedByRef?.lastName}
                {" · "}
                {new Date(request.createdAt).toLocaleString()}
              </p>
              {request.resolutionSummary && (
                <p className="mt-3 line-clamp-3 text-sm text-[var(--foreground)]">
                  {request.resolutionSummary}
                </p>
              )}
              <Link
                href={`${complaintPath}/${request.complaintRef?._id}`}
                className="mt-4 inline-flex rounded-lg bg-[var(--primary)] px-3 py-2 text-sm font-semibold text-[var(--primary-foreground)]"
              >
                Review request
              </Link>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
