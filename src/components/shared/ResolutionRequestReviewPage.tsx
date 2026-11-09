import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { isOfficeHead } from "@/lib/office-head";
import { ResolutionRequest } from "@/models/ResolutionRequest";
import { ResolutionApprovalPanel } from "@/components/staff/ResolutionApprovalPanel";
import { StatusBadge } from "@/components/shared/StatusBadge";

export async function ResolutionRequestReviewPage({
  params,
  base,
}: {
  params: Promise<{ id: string }>;
  base: "admin" | "staff";
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  await connectToDatabase();
  const { id } = await params;
  const request: any = await ResolutionRequest.findById(id)
    .populate("complaintRef", "ticketNumber title status")
    .populate("requestedByRef", "firstName lastName")
    .lean();

  if (!request || !(await isOfficeHead(session.user.id, request.officeRef))) notFound();

  const displayRequest = JSON.parse(JSON.stringify(request));
  const complaint = request.complaintRef;

  return (
    <div className="workspace-page max-w-3xl space-y-5">
      <Link
        href={`/${base}/resolution-requests`}
        className="text-sm text-[var(--muted-foreground)] hover:underline"
      >
        Back to resolution requests
      </Link>
      <header className="space-y-2 border-b border-[var(--border)] pb-5">
        <p className="font-mono text-xs text-[var(--muted-foreground)]">
          {complaint?.ticketNumber ?? "Complaint unavailable"}
        </p>
        <h1 className="text-2xl font-bold">{complaint?.title ?? "Complaint details unavailable"}</h1>
        {complaint ? (
          <div className="flex items-center gap-3">
            <StatusBadge status={complaint.status} />
            <Link
              href={`/${base}/complaints/${complaint._id}`}
              className="text-sm text-[var(--primary)] hover:underline"
            >
              Open full complaint
            </Link>
          </div>
        ) : (
          <p className="text-sm text-[var(--destructive)]">
            This request refers to a complaint that is no longer available, so it cannot be reviewed.
          </p>
        )}
      </header>
      <section className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-5">
        <h2 className="text-sm font-semibold">Requested resolution</h2>
        <p className="mt-2 whitespace-pre-wrap text-sm">
          {request.resolutionSummary || "No resolution details provided."}
        </p>
        {request.message && (
          <p className="mt-3 whitespace-pre-wrap text-sm text-[var(--muted-foreground)]">
            {request.message}
          </p>
        )}
        <p className="mt-3 text-xs text-[var(--muted-foreground)]">
          Submitted by {request.requestedByRef?.firstName ?? "Staff"}{" "}
          {request.requestedByRef?.lastName ?? ""}
        </p>
      </section>
      {complaint && <ResolutionApprovalPanel request={displayRequest} canReview />}
    </div>
  );
}
