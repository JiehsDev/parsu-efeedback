import Link from "next/link";
import { Archive, ArrowRight, Building2, Clock3, UserRound } from "lucide-react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { ArchiveRequest } from "@/models/ArchiveRequest";
import { Office } from "@/models/Office";
import { ArchiveApprovalPanel } from "@/components/staff/ArchiveApprovalPanel";

export default async function AdminArchiveRequestsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!["administrator", "vpaa", "vpaf", "osas"].includes(session.user.role)) redirect("/dashboard");
  await connectToDatabase();

  const isAdministrator = session.user.role === "administrator";
  const headedOffices = isAdministrator
    ? null
    : await Office.find({ headUserRef: session.user.id, isActive: true }).select("_id name type code").lean();
  const filter: Record<string, any> = isAdministrator
    ? { status: "pending" }
    : { status: "pending", officeRef: { $in: (headedOffices ?? []).map((office) => office._id) } };
  const requests = await ArchiveRequest.find(filter)
    .sort({ createdAt: -1 })
    .populate({ path: "complaintRef", select: "ticketNumber title description status assignedOfficeRef assignedStaffRef", populate: [{ path: "assignedOfficeRef", select: "name type" }, { path: "assignedStaffRef", select: "firstName lastName" }] })
    .populate("officeRef", "name type")
    .populate("requestedByRef", "firstName lastName role")
    .lean();

  return <div className="mx-auto max-w-5xl space-y-6"><header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-semibold tracking-wide text-[var(--primary)] uppercase">Operational review</p><h1 className="mt-1 text-3xl font-bold tracking-tight text-[var(--foreground)]">Archive Requests</h1><p className="mt-1 text-sm text-[var(--muted-foreground)]">Review requests for offices you head. Approvals retain the complaint and remove it from active processing.</p></div><Link href="/admin/complaints?archived=1" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--primary)] hover:underline">Archived complaints <ArrowRight className="h-4 w-4" /></Link></header>{requests.length === 0 ? <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--card)] px-6 py-16 text-center"><Archive className="mx-auto h-8 w-8 text-[var(--muted-foreground)]" /><p className="mt-3 text-sm font-medium text-[var(--foreground)]">No pending archive requests</p><p className="mt-1 text-xs text-[var(--muted-foreground)]">New requests will appear here when office staff submit them.</p></div> : <div className="space-y-4">{requests.map((request: any) => { const complaint = request.complaintRef; const requester = request.requestedByRef; const assigned = complaint?.assignedStaffRef; return <article key={String(request._id)} className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm"><div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><Link href={`/admin/complaints/${complaint?._id}`} className="font-mono text-xs font-semibold text-[var(--primary)] hover:underline">{complaint?.ticketNumber ?? "Unknown ticket"}</Link><span className="rounded-full bg-[var(--qa-amber-soft)] px-2 py-0.5 text-[10px] font-semibold text-[var(--qa-amber-strong)] uppercase">Pending review</span></div><h2 className="mt-1 truncate text-lg font-semibold text-[var(--foreground)]">{complaint?.title ?? "Complaint unavailable"}</h2><div className="mt-3 grid gap-2 text-xs text-[var(--muted-foreground)] sm:grid-cols-2"><span className="inline-flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" />{request.officeRef?.name ?? complaint?.assignedOfficeRef?.name ?? "Office unavailable"}</span><span className="inline-flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5" />Requested {new Date(request.createdAt).toLocaleString()}</span><span>Current status: <strong className="font-semibold capitalize text-[var(--foreground)]">{String(complaint?.status ?? "unknown").replaceAll("_", " ")}</strong></span><span className="inline-flex items-center gap-1.5"><UserRound className="h-3.5 w-3.5" />{assigned ? `${assigned.firstName} ${assigned.lastName}` : "Unassigned"}</span></div><p className="mt-3 text-sm text-[var(--muted-foreground)]">Requested by <span className="font-medium text-[var(--foreground)]">{requester?.firstName} {requester?.lastName}</span> · {request.reason}</p>{request.supportingNote && <p className="mt-2 rounded-lg bg-[var(--muted)] px-3 py-2 text-xs text-[var(--muted-foreground)]">Supporting note: {request.supportingNote}</p>}</div><Link href={`/admin/complaints/${complaint?._id}`} className="inline-flex shrink-0 items-center justify-center rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-semibold text-[var(--foreground)] hover:bg-[var(--muted)]">Review complaint</Link></div><div className="mt-4 border-t border-[var(--border)] pt-4"><ArchiveApprovalPanel request={JSON.parse(JSON.stringify(request))} /></div></article>; })}</div>}</div>;
}
