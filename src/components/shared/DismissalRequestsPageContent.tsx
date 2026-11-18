import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import {
  isResolutionRequestHead,
  resolutionRequestOfficeFilter,
} from "@/features/complaints/services/resolution-request-query.service";
import { Office } from "@/models/Office";
import { DismissalRequest } from "@/models/DismissalRequest";
import { DismissalDecisionPanel } from "@/components/staff/DismissalDecisionPanel";

export async function DismissalRequestsPageContent({ base }: { base: "admin" | "staff" }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (base === "admin" && !["osas", "vpaa", "vpaf"].includes(session.user.role))
    redirect("/dashboard");
  if (base === "staff" && session.user.role !== "office_staff") redirect("/dashboard");
  await connectToDatabase();
  if (!(await isResolutionRequestHead(session.user)))
    redirect(base === "admin" ? "/admin/dashboard" : "/staff/dashboard");
  const officeFilter = resolutionRequestOfficeFilter(session.user)!;
  const offices = await Office.find({
    ...officeFilter,
    headUserRef: session.user.id,
    isActive: true,
  })
    .select("_id")
    .lean();
  const requests = await DismissalRequest.find({
    status: "pending",
    officeRef: { $in: offices.map((office) => office._id) },
  })
    .sort({ createdAt: -1 })
    .populate("complaintRef", "ticketNumber title status")
    .populate("requestedByRef", "firstName lastName role")
    .lean();
  return (
    <div className="workspace-page space-y-6">
      <header>
        <p className="text-xs font-semibold tracking-wide text-[var(--primary)] uppercase">
          Office Head Review
        </p>
        <h1 className="mt-1 text-3xl font-bold">Dismissal Requests</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          Review staff requests to dismiss complaints in your office.
        </p>
      </header>
      {requests.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--border)] p-10 text-center text-sm">
          No pending dismissal requests
        </p>
      ) : (
        <div className="space-y-4">
          {requests.map((request: any) => (
            <article
              key={String(request._id)}
              className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4"
            >
              {request.complaintRef && (
                <Link
                  href={`/${base}/complaints/${request.complaintRef._id}`}
                  className="font-mono text-sm text-[var(--primary)] hover:underline"
                >
                  {request.complaintRef.ticketNumber}
                </Link>
              )}
              <h2 className="mt-1 font-semibold">
                {request.complaintRef?.title ?? "Complaint unavailable"}
              </h2>
              <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                Submitted {new Date(request.createdAt).toLocaleString()}
              </p>
              <div className="mt-3">
                <DismissalDecisionPanel request={JSON.parse(JSON.stringify(request))} canReview />
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
