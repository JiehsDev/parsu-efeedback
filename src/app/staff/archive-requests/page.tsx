import { redirect } from "next/navigation";
import Link from "next/link";
import { Archive } from "lucide-react";
import { auth } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { Office } from "@/models/Office";
import { ArchiveRequest } from "@/models/ArchiveRequest";
import { ArchiveApprovalPanel } from "@/components/staff/ArchiveApprovalPanel";

export default async function ArchiveRequestsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  await connectToDatabase();
  const isAdmin = session.user.role === "administrator";
  const offices = isAdmin ? null : await Office.find({ headUserRef: session.user.id, isActive: true }).select("_id").lean();
  if (!isAdmin && !offices?.length) redirect("/staff/dashboard");
  const requests = await ArchiveRequest.find(isAdmin ? { status: "pending" } : { status: "pending", officeRef: { $in: offices!.map((office) => office._id) } }).sort({ createdAt: -1 }).populate("complaintRef", "ticketNumber title status").populate("requestedByRef", "firstName lastName role").lean();
  return <div className="mx-auto max-w-4xl space-y-6"><div><p className="text-xs font-semibold tracking-wide text-[var(--primary)] uppercase">Office Head Review</p><h1 className="mt-1 text-3xl font-bold tracking-tight text-[var(--foreground)]">Archive Requests</h1><p className="mt-1 text-sm text-[var(--muted-foreground)]">Review completed complaints submitted by staff for archival.</p></div>{requests.length === 0 ? <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--card)] px-6 py-14 text-center"><Archive className="mx-auto h-8 w-8 text-[var(--muted-foreground)]" /><p className="mt-3 text-sm font-medium">No pending archive requests</p></div> : <div className="space-y-3">{requests.map((request: any) => <div key={String(request._id)} className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4"><Link href={`/staff/complaints/${request.complaintRef?._id}`} className="font-mono text-xs text-[var(--primary)] hover:underline">{request.complaintRef?.ticketNumber}</Link><h2 className="mt-1 text-base font-semibold text-[var(--foreground)]">{request.complaintRef?.title}</h2><p className="mt-2 text-sm text-[var(--muted-foreground)]">Requested by {request.requestedByRef?.firstName} {request.requestedByRef?.lastName} on {new Date(request.createdAt).toLocaleString()}</p><div className="mt-3"><ArchiveApprovalPanel request={JSON.parse(JSON.stringify(request))} /></div></div>)}</div>}</div>;
}
