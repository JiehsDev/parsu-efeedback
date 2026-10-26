import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { ForwardingRequest } from "@/models/ForwardingRequest";
import { forwardingHistoryFilter } from "@/features/forwarding/forwarding.service";
import { canAccessComplaint } from "@/lib/complaint-access";
import { Complaint } from "@/models/Complaint";
export async function ForwardingRequestsPage({ base }: { base: "admin" | "staff" }) {
  const session = await auth();
  if (!session?.user) notFound();
  await connectToDatabase();
  let filter;
  try {
    filter = await forwardingHistoryFilter(session);
  } catch {
    notFound();
  }
  const requests = await ForwardingRequest.find(filter)
    .sort({ requestedAt: -1 })
    .limit(100)
    .populate("complaintRef", "ticketNumber title")
    .populate("requestedByUserRef reviewedByUserRef", "firstName lastName")
    .lean();
  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <header>
        <h1 className="text-2xl font-semibold">Forwarding Requests</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          Review requests and track their decisions.
        </p>
      </header>
      {!requests.length && (
        <p className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
          No forwarding requests yet.
        </p>
      )}
      {await Promise.all(
        requests.map(async (request: any) => {
          const complaint = request.complaintRef
            ? await Complaint.findById(request.complaintRef._id).lean()
            : null;
          const accessible = complaint && (await canAccessComplaint(session, complaint));
          return (
            <article
              key={String(request._id)}
              className="space-y-2 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5"
            >
              <p className="font-mono text-xs">
                {request.complaintRef?.ticketNumber ?? "Historical complaint"}
              </p>
              <h2 className="font-semibold">{request.complaintRef?.title ?? "Complaint"}</h2>
              <p className="text-sm">
                To {request.requestedDestination.toUpperCase()} · {request.status}
              </p>
              <p className="text-sm break-words whitespace-pre-wrap">{request.reason}</p>
              <p className="text-xs text-[var(--muted-foreground)]">
                Requested by {request.requestedByUserRef?.firstName}{" "}
                {request.requestedByUserRef?.lastName} ·{" "}
                {new Date(request.requestedAt).toLocaleString()}
              </p>
              {request.reviewedAt && (
                <p className="text-xs text-[var(--muted-foreground)]">
                  Reviewed by {request.reviewedByUserRef?.firstName}{" "}
                  {request.reviewedByUserRef?.lastName} ·{" "}
                  {new Date(request.reviewedAt).toLocaleString()}
                </p>
              )}
              {request.reviewReason && (
                <p className="text-sm break-words whitespace-pre-wrap">
                  Decision: {request.reviewReason}
                </p>
              )}
              {accessible && (
                <Link
                  className="inline-block text-sm font-semibold underline"
                  href={`/${base}/complaints/${request.complaintRef._id}`}
                >
                  Review complaint
                </Link>
              )}
            </article>
          );
        }),
      )}
    </div>
  );
}
