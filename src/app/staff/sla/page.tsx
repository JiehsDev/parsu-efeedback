import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, ArrowUpRight, CheckCircle2, Clock3, Inbox, Timer } from "lucide-react";
import { auth } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { Complaint } from "@/models/Complaint";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { CopyButton } from "@/components/shared/CopyButton";
import type { ComplaintStatus } from "@/lib/constants";
import { escapeRegExp } from "@/lib/utils";
import { slaClock, type ComplaintRowData } from "@/components/shared/ComplaintListRow";

const DUE_SOON_WINDOW_MS = 24 * 60 * 60 * 1000;
type View = "all" | "overdue" | "due" | "track";

type SlaItem = ComplaintRowData & {
  slaState: "overdue" | "due" | "track";
  dueAt: Date | null;
  dueText: string;
  urgencyText: string;
};

function formatDeadline(dueAt: Date | null, state: SlaItem["slaState"]) {
  if (!dueAt) return { dueText: "No deadline", urgencyText: "No active SLA clock" };
  const diff = dueAt.getTime() - Date.now();
  const hours = Math.max(1, Math.round(Math.abs(diff) / (60 * 60 * 1000)));
  const days = Math.floor(hours / 24);
  const remainder = hours % 24;
  const duration = days > 0 ? `${days}d${remainder ? ` ${remainder}h` : ""}` : `${hours}h`;
  if (state === "overdue") return { dueText: `${duration} overdue`, urgencyText: "Needs immediate attention" };
  if (state === "due") return { dueText: diff < 2 * 60 * 60 * 1000 ? `Due in ${duration}` : `Due in ${duration}`, urgencyText: "Approaching deadline" };
  return { dueText: `Due ${dueAt.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`, urgencyText: "No urgent items" };
}

function buildHref(params: Record<string, string | undefined>) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => value && query.set(key, value));
  const text = query.toString();
  return text ? `/staff/sla?${text}` : "/staff/sla";
}

function SummaryCard({ label, value, subtext, tone, icon: Icon }: { label: string; value: number; subtext: string; tone: "neutral" | "rose" | "amber" | "green"; icon: typeof Inbox }) {
  const styles = {
    neutral: "border-[var(--border)] bg-[var(--card)] text-[var(--foreground)]",
    rose: "border-[var(--qa-rose)]/30 bg-[var(--qa-rose-soft)] text-[var(--qa-rose-strong)]",
    amber: "border-[var(--qa-amber)]/30 bg-[var(--qa-amber-soft)] text-[var(--qa-amber-strong)]",
    green: "border-[var(--qa-success)]/30 bg-[var(--qa-success-soft)] text-[var(--qa-success-strong)]",
  }[tone];
  return <div className={`rounded-2xl border px-4 py-3.5 ${styles}`}><div className="flex items-start justify-between gap-3"><div><p className="text-2xl font-bold leading-none tracking-tight tabular-nums">{value}</p><p className="mt-1.5 text-xs font-semibold">{label}</p></div><Icon className="h-4 w-4 opacity-75" /></div><p className="mt-2 text-[11px] opacity-80">{subtext}</p></div>;
}

function SlaRow({ item }: { item: SlaItem }) {
  const rowTone = item.slaState === "overdue" ? "border-l-[var(--qa-rose)] bg-[var(--qa-rose-soft)]/35" : item.slaState === "due" ? "border-l-[var(--qa-amber)] bg-[var(--qa-amber-soft)]/30" : "border-l-transparent";
  const stateTone = item.slaState === "overdue" ? "text-[var(--qa-rose-strong)]" : item.slaState === "due" ? "text-[var(--qa-amber-strong)]" : "text-[var(--qa-success-strong)]";
  const stateLabel = item.slaState === "overdue" ? "Overdue" : item.slaState === "due" ? "Due Soon" : "On Track";
  return <li className={`border-l-4 ${rowTone} border-b border-[var(--border)] last:border-b-0`}><Link href={`/staff/complaints/${String(item._id)}`} aria-label={`View ${item.ticketNumber}: ${item.title}`} className="group block px-4 py-3.5 outline-none transition-colors hover:bg-[var(--muted)]/45 focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-inset"><div className="grid items-center gap-3 lg:grid-cols-[8.5rem_minmax(14rem,1fr)_5.5rem_7.5rem_8rem_8.5rem_5rem]"><div className="flex items-center gap-1 font-mono text-xs text-[var(--muted-foreground)]"><span className="truncate">{item.ticketNumber}</span><CopyButton value={item.ticketNumber} className="opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100" /></div><div className="min-w-0"><p className="truncate text-sm font-semibold text-[var(--foreground)]">{item.title}</p><p className="mt-0.5 truncate text-xs text-[var(--muted-foreground)]">Updated {item.updatedAt.toLocaleDateString()}</p></div><span className={`w-fit rounded-md px-2 py-1 text-[11px] font-semibold capitalize ${item.priority === "critical" ? "bg-[var(--qa-rose-soft)] text-[var(--qa-rose-strong)]" : item.priority === "high" ? "bg-[var(--qa-amber-soft)] text-[var(--qa-amber-strong)]" : "bg-[var(--muted)] text-[var(--muted-foreground)]"}`}>{item.priority}</span><span className="hidden lg:block"><StatusBadge status={item.status as ComplaintStatus} /></span><span className={`hidden text-xs font-semibold lg:block ${stateTone}`}><span className="block">{stateLabel}</span><span className="mt-0.5 block text-[11px] font-normal opacity-80">{item.urgencyText}</span></span><span className={`text-xs font-semibold tabular-nums ${stateTone}`}>{item.dueText}</span><span className="hidden items-center justify-end gap-1 text-xs font-semibold text-[var(--primary)] lg:flex">View <ArrowUpRight className="h-3.5 w-3.5" /></span></div><div className="mt-2 flex items-center gap-2 lg:hidden"><StatusBadge status={item.status as ComplaintStatus} /><span className={`text-xs font-semibold ${stateTone}`}>{stateLabel} · {item.urgencyText}</span><span className="ml-auto text-xs font-semibold text-[var(--primary)]">View</span></div></Link></li>;
}

function EmptyQueue({ view }: { view: View }) {
  const message = view === "overdue" ? "No overdue complaints. Good job." : view === "due" ? "No complaints are due within the next 24 hours." : "No open complaints currently under SLA monitoring.";
  return <div className="flex items-center gap-3 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--card)] px-5 py-8"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--qa-success-soft)] text-[var(--qa-success-strong)]"><CheckCircle2 className="h-5 w-5" /></span><div><p className="text-sm font-semibold text-[var(--foreground)]">{message}</p><p className="mt-0.5 text-xs text-[var(--muted-foreground)]">Your queue is clear for this view.</p></div></div>;
}

export default async function StaffSlaPage({ searchParams }: { searchParams: Promise<{ view?: string; q?: string; priority?: string; status?: string; sort?: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  await connectToDatabase();
  const params = await searchParams;
  const view: View = ["overdue", "due", "track"].includes(params.view ?? "") ? (params.view as View) : "all";
  const search = params.q?.trim();
  const complaintFilter: Record<string, unknown> = { assignedOfficeRef: session.user.officeRef, status: { $nin: ["resolved", "closed", "withdrawn"] }, isArchived: false, ...(params.priority ? { priority: params.priority } : {}), ...(params.status ? { status: params.status } : {}), ...(search ? { $or: [{ title: { $regex: escapeRegExp(search), $options: "i" } }, { ticketNumber: { $regex: escapeRegExp(search), $options: "i" } }] } : {}) };
  const complaints = await Complaint.find(complaintFilter as any).lean();
  const now = Date.now();
  const items: SlaItem[] = (complaints as unknown as ComplaintRowData[]).map((complaint) => { const clock = slaClock(complaint); const dueAt = clock?.dueAt ? new Date(clock.dueAt) : null; const diff = dueAt ? dueAt.getTime() - now : Infinity; const slaState: SlaItem["slaState"] = clock?.overdue ? "overdue" : diff <= DUE_SOON_WINDOW_MS ? "due" : "track"; return { ...complaint, dueAt, slaState, ...formatDeadline(dueAt, slaState) }; });
  const overdue = items.filter((item) => item.slaState === "overdue");
  const due = items.filter((item) => item.slaState === "due");
  const track = items.filter((item) => item.slaState === "track");
  const visible = view === "overdue" ? overdue : view === "due" ? due : view === "track" ? track : items;
  const sorted = [...visible].sort((a, b) => params.sort === "updated" ? new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime() : (a.dueAt?.getTime() ?? Infinity) - (b.dueAt?.getTime() ?? Infinity));
  const tabs: Array<{ value: View; label: string; count: number }> = [{ value: "all", label: "All", count: items.length }, { value: "overdue", label: "Overdue", count: overdue.length }, { value: "due", label: "Due in 24h", count: due.length }, { value: "track", label: "On Track", count: track.length }];
  const preserved = { q: search, priority: params.priority, status: params.status, sort: params.sort };
  return <div className="mx-auto max-w-[1440px] space-y-5"><header className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-semibold tracking-wide text-[var(--primary)] uppercase">Operations · Deadline monitoring</p><h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--foreground)] sm:text-3xl">SLA Tracker</h1><p className="mt-1 text-sm text-[var(--muted-foreground)]">Start with the most urgent complaints in your office and work down the queue.</p></div><p className="text-xs text-[var(--muted-foreground)]">{items.length} open complaint{items.length === 1 ? "" : "s"} under monitoring</p></header><section className="grid grid-cols-2 gap-3 lg:grid-cols-4"><SummaryCard label="Total Open" value={items.length} subtext="Currently under SLA" tone="neutral" icon={Inbox} /><SummaryCard label="Overdue" value={overdue.length} subtext={overdue.length ? "Needs immediate attention" : "No urgent items"} tone="rose" icon={AlertTriangle} /><SummaryCard label="Due Within 24h" value={due.length} subtext={due.length ? "Approaching deadline" : "No near-term deadlines"} tone="amber" icon={Timer} /><SummaryCard label="On Track" value={track.length} subtext={track.length ? "Within the current window" : "No remaining items"} tone="green" icon={CheckCircle2} /></section><section className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3 sm:p-4"><div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><nav aria-label="SLA quick views" className="flex flex-wrap gap-1 rounded-xl bg-[var(--muted)]/55 p-1">{tabs.map((tab) => <Link key={tab.value} href={buildHref({ ...preserved, view: tab.value === "all" ? undefined : tab.value })} aria-current={view === tab.value ? "page" : undefined} className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${view === tab.value ? "bg-[var(--card)] text-[var(--foreground)] shadow-sm" : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"}`}>{tab.label} <span className="ml-1 tabular-nums opacity-65">{tab.count}</span></Link>)}</nav><form method="get" className="flex flex-wrap gap-2"><input type="hidden" name="view" value={view === "all" ? "" : view} /><label className="sr-only" htmlFor="sla-search">Search SLA complaints</label><input id="sla-search" name="q" defaultValue={search} placeholder="Search ticket or title" className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-xs text-[var(--foreground)] outline-none focus:border-[var(--ring)] sm:w-48" /><select name="priority" defaultValue={params.priority ?? ""} aria-label="Filter by priority" className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-2 text-xs text-[var(--foreground)]"><option value="">All priorities</option><option value="critical">Critical</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select><select name="sort" defaultValue={params.sort ?? ""} aria-label="Sort SLA complaints" className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-2 text-xs text-[var(--foreground)]"><option value="">Most urgent first</option><option value="updated">Recently updated</option></select><button type="submit" className="rounded-lg bg-[var(--foreground)] px-3 py-2 text-xs font-semibold text-[var(--card)]">Apply</button></form></div></section>{sorted.length === 0 ? <EmptyQueue view={view} /> : <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)]" aria-labelledby="sla-queue-heading"><div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3"><div><h2 id="sla-queue-heading" className="text-sm font-semibold text-[var(--foreground)]">Work queue</h2><p className="mt-0.5 text-xs text-[var(--muted-foreground)]">Prioritized by deadline. Open a complaint to take action.</p></div><Clock3 className="h-4 w-4 text-[var(--muted-foreground)]" /></div><div className="hidden grid-cols-[8.5rem_minmax(14rem,1fr)_5.5rem_7.5rem_8rem_8.5rem_5rem] gap-3 border-b border-[var(--border)] bg-[var(--muted)]/35 px-4 py-2 text-[10px] font-semibold tracking-wide text-[var(--muted-foreground)] uppercase lg:grid"><span>Ticket</span><span>Complaint</span><span>Priority</span><span>Status</span><span>SLA state</span><span>Due</span><span className="text-right">Action</span></div><ul>{sorted.map((item) => <SlaRow key={String(item._id)} item={item} />)}</ul></section>}</div>;
}
