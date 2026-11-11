import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeftRight } from "lucide-react";
import { auth } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { isOsasHead } from "@/lib/osas-operations";
import {
  listPendingOfficeReturnRequests,
  listRecentOfficeReturnDecisions,
} from "@/features/complaints/services/office-return-query.service";
import { canAccessComplaint } from "@/lib/complaint-access";
import { OfficeReturnRequestDecision } from "@/components/shared/OfficeReturnRequestDecision";

interface ReturnRequestItem {
  _id: string;
  reason: string;
  requestedAt: string;
  status: "pending" | "approved" | "rejected";
  complaintStatus: string;
  reviewedAt?: string | null;
  reviewReason?: string;
  forwardedToRole: "vpaa" | "vpaf";
  complaintRef: {
    _id: string;
    ticketNumber: string;
    title: string;
    description: string;
    status: string;
    priority: string;
    categoryRef?: { name?: string } | null;
  } | null;
  sourceOfficeRef?: { name?: string; code?: string } | null;
  requestedByUserRef?: { firstName?: string; lastName?: string } | null;
  reviewedByUserRef?: { firstName?: string; lastName?: string } | null;
}

export async function OfficeReturnRequestsContent({ base }: { base: "admin" | "staff" }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (
    (base === "staff" && session.user.role !== "office_staff") ||
    (base === "admin" && session.user.role !== "osas")
  )
    redirect("/dashboard");

  await connectToDatabase();
  if (!(await isOsasHead(session))) redirect(`/${base}/dashboard`);
  const requests = JSON.parse(
    JSON.stringify(await listPendingOfficeReturnRequests(session)),
  ) as ReturnRequestItem[];
  const decisions = JSON.parse(
    JSON.stringify(await listRecentOfficeReturnDecisions(session)),
  ) as ReturnRequestItem[];

  return (
    <div className="workspace-page space-y-6">
      <header>
        <p className="text-xs font-semibold tracking-wide text-[var(--primary)] uppercase">
          OSAS Office Head Review
        </p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-[var(--foreground)]">
          Return-to-OSAS Requests
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-[var(--muted-foreground)]">
          Review complaints that VPAA or VPAF handlers believe were sent to the wrong office.
          Approving returns them to the OSAS complaints list without changing status or SLA deadlines.
        </p>
      </header>

      {requests.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--card)] px-6 py-14 text-center">
          <ArrowLeftRight className="mx-auto h-8 w-8 text-[var(--muted-foreground)]" />
          <p className="mt-3 text-sm font-medium">No pending return requests</p>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((request) => (
            <article
              key={request._id}
              className="space-y-3 rounded-lg border border-[var(--border)] bg-[var(--card)] p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-mono text-xs text-[var(--muted-foreground)]">
                    {request.complaintRef?.ticketNumber ?? "Complaint unavailable"}
                  </p>
                  <h2 className="mt-1 text-lg font-semibold">
                    {request.complaintRef?.title ?? "Complaint details unavailable"}
                  </h2>
                </div>
                <span className="rounded-full bg-[var(--muted)] px-2.5 py-1 text-xs font-semibold">
                  From {request.sourceOfficeRef?.name ?? request.forwardedToRole.toUpperCase()}
                </span>
              </div>
              <p className="text-xs text-[var(--muted-foreground)]">
                {request.complaintRef?.categoryRef?.name ?? "Category unavailable"} · Priority {request.complaintRef?.priority ?? "unknown"} · Status {request.complaintRef?.status ?? "unknown"}
              </p>
              {request.complaintRef?.description && (
                <p className="whitespace-pre-wrap text-sm text-[var(--foreground)]">
                  {request.complaintRef.description}
                </p>
              )}
              <div className="rounded-lg bg-[var(--muted)]/50 p-3">
                <p className="text-xs font-semibold text-[var(--muted-foreground)]">Reason for return</p>
                <p className="mt-1 whitespace-pre-wrap text-sm">{request.reason}</p>
              </div>
              <p className="text-xs text-[var(--muted-foreground)]">
                Requested by {request.requestedByUserRef?.firstName ?? "Receiving office handler"}{" "}
                {request.requestedByUserRef?.lastName ?? ""} · {new Date(request.requestedAt).toLocaleString()}
              </p>
              <OfficeReturnRequestDecision requestId={request._id} />
            </article>
          ))}
        </div>
      )}

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-[var(--foreground)]">Return request history</h2>
          <p className="text-sm text-[var(--muted-foreground)]">
            Recent decisions for complaints forwarded from OSAS, including who requested and reviewed each return.
          </p>
        </div>
        {decisions.length === 0 ? (
          <p className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 text-sm text-[var(--muted-foreground)]">
            No return requests have been decided yet.
          </p>
        ) : (
          <div className="space-y-3">
            {await Promise.all(decisions.map(async (request) => {
              const complaint: any = request.complaintRef;
              const accessible = complaint && await canAccessComplaint(session, complaint);
              return (
                <article key={request._id} className="space-y-2 rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-mono text-xs text-[var(--muted-foreground)]">
                        {complaint?.ticketNumber ?? "Complaint unavailable"}
                      </p>
                      <h3 className="font-semibold">{complaint?.title ?? "Complaint details unavailable"}</h3>
                    </div>
                    <span className="rounded-full bg-[var(--muted)] px-2.5 py-1 text-xs font-semibold">
                      {request.status === "approved" ? "Returned to OSAS" : "Return rejected"}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    From {request.sourceOfficeRef?.name ?? request.forwardedToRole.toUpperCase()} · Status when requested: {request.complaintStatus}
                  </p>
                  <p className="text-sm whitespace-pre-wrap">Return reason: {request.reason}</p>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    Requested by {request.requestedByUserRef?.firstName ?? "Receiving office handler"} {request.requestedByUserRef?.lastName ?? ""} · {new Date(request.requestedAt).toLocaleString()}
                  </p>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    Reviewed by {request.reviewedByUserRef?.firstName ?? "OSAS Office Head"} {request.reviewedByUserRef?.lastName ?? ""} · {request.reviewedAt ? new Date(request.reviewedAt).toLocaleString() : "Date unavailable"}
                  </p>
                  {request.reviewReason && <p className="text-sm whitespace-pre-wrap">Decision reason: {request.reviewReason}</p>}
                  {accessible && (
                    <Link className="inline-block text-sm font-semibold underline" href={`/${base}/complaints/${complaint._id}`}>
                      Open complaint and view timeline
                    </Link>
                  )}
                </article>
              );
            }))}
          </div>
        )}
      </section>
    </div>
  );
}
