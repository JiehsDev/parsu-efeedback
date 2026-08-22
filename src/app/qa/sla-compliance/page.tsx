// src/app/qa/sla-compliance/page.tsx
import { Suspense } from "react";
import { AlertTriangle, Building2, CheckCircle2, TrendingUp, Timer } from "lucide-react";
import { connectToDatabase } from "@/lib/db";
import { Complaint } from "@/models/Complaint";
import { Office } from "@/models/Office";
import { User } from "@/models/User";
import {
  getSlaComplianceByOffice,
  getSlaTrendSeries,
} from "@/features/analytics/services/analytics.service";
import { QaTrendChart } from "@/components/qa/charts/QaTrendChart";
import { ListSortSelect } from "@/components/shared/ListSortSelect";

const MONTH_LABELS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default async function QaSlaCompliancePage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string; college?: string; overdueScope?: string }>;
}) {
  await connectToDatabase();

  const {
    year: yearParam,
    month: monthParam,
    college: collegeParam,
    overdueScope,
  } = await searchParams;

  const currentYear = new Date().getFullYear();
  const year = yearParam ? Number(yearParam) : currentYear;
  const month = monthParam ? Number(monthParam) : null;

  // "office:<id>" or "college:<id>" — a college scope has no direct field
  // on Complaint, so it's resolved to a set of student IDs first.
  const [scopeType, scopeId] = overdueScope?.split(":") ?? [];
  const overdueFilter: Record<string, unknown> = {
    isOverdue: true,
    status: { $nin: ["resolved", "closed"] },
    isArchived: false,
  };
  if (scopeType === "office" && scopeId) {
    overdueFilter.assignedOfficeRef = scopeId;
  } else if (scopeType === "college" && scopeId) {
    const studentsInCollege = await User.find({ collegeRef: scopeId }).select("_id").lean();
    overdueFilter.studentRef = { $in: studentsInCollege.map((s) => s._id) };
  }

  const [officeBreakdown, currentlyOverdue, allOffices, trend] = await Promise.all([
    getSlaComplianceByOffice(),
    Complaint.find(overdueFilter)
      .populate("assignedOfficeRef", "name")
      .sort({ slaResolutionDueAt: 1 })
      .limit(50)
      .lean(),
    Office.find({ isActive: true }).sort({ name: 1 }).lean(),
    getSlaTrendSeries({ year, month, collegeId: collegeParam || null }),
  ]);

  const colleges = allOffices.filter((o: any) => o.type === "college");
  const serviceOffices = allOffices.filter((o: any) => o.type === "service_office");

  const yearOptions = [currentYear, currentYear - 1, currentYear - 2].map((y) => ({
    value: String(y),
    label: String(y),
  }));
  const monthOptions = [
    { value: "", label: "All months" },
    ...MONTH_LABELS.map((label, i) => ({ value: String(i + 1), label })),
  ];
  const collegeOptions = [
    { value: "", label: "All colleges" },
    ...colleges.map((c: any) => ({ value: String(c._id), label: c.name })),
  ];
  const overdueScopeOptions = [
    { value: "", label: "All offices & colleges" },
    ...serviceOffices.map((o: any) => ({ value: `office:${o._id}`, label: o.name })),
    ...colleges.map((c: any) => ({ value: `college:${c._id}`, label: c.name })),
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-[var(--foreground)]">
          SLA Compliance
        </h1>
        <p className="mt-1.5 text-sm text-[var(--muted-foreground)]">
          Institution-wide compliance rate by office, and currently overdue complaints.
        </p>
      </div>

      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 px-1">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
            <TrendingUp className="h-3 w-3" />
            SLA trend
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Suspense fallback={<div className="h-11 w-28" />}>
              <ListSortSelect options={yearOptions} paramName="year" />
            </Suspense>
            <Suspense fallback={<div className="h-11 w-36" />}>
              <ListSortSelect options={monthOptions} paramName="month" placeholder="All months" />
            </Suspense>
            <Suspense fallback={<div className="h-11 w-40" />}>
              <ListSortSelect
                options={collegeOptions}
                paramName="college"
                placeholder="All colleges"
              />
            </Suspense>
          </div>
        </div>
        <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5">
          <div className="h-57.5">
            <QaTrendChart data={trend} />
          </div>
        </div>
      </div>

      <div>
        <p className="mb-3 flex items-center gap-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
          <Building2 className="h-3 w-3" />
          Compliance by office
        </p>
        <div className="overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--card)]">
          <ul className="divide-y divide-[var(--border)]">
            {officeBreakdown.map((row) => {
              const tone =
                row.percent >= 80
                  ? "text-[var(--qa-success)]"
                  : row.percent >= 50
                    ? "text-[var(--qa-amber)]"
                    : "text-[var(--destructive)]";
              const barTone =
                row.percent >= 80
                  ? "bg-[var(--qa-success)]"
                  : row.percent >= 50
                    ? "bg-[var(--qa-amber)]"
                    : "bg-[var(--destructive)]";
              return (
                <li key={row.office} className="flex items-center gap-4 px-5 py-4">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-[var(--foreground)]">
                      {row.office}
                    </span>
                    <span className="mt-1 block h-1.5 w-full max-w-40 overflow-hidden rounded-full bg-[var(--muted)]">
                      <span
                        className={`block h-full rounded-full ${barTone}`}
                        style={{ width: `${row.percent}%` }}
                      />
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-[var(--muted-foreground)]">
                    {row.compliant}/{row.total} within SLA
                  </span>
                  <span className={`w-12 shrink-0 text-right text-sm font-bold ${tone}`}>
                    {row.percent}%
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 px-1">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--destructive)]">
            <AlertTriangle className="h-3 w-3" />
            Currently overdue
          </p>
          <Suspense fallback={<div className="h-11 w-48" />}>
            <ListSortSelect
              options={overdueScopeOptions}
              paramName="overdueScope"
              placeholder="All offices & colleges"
            />
          </Suspense>
        </div>
        {currentlyOverdue.length === 0 ? (
          <div className="flex flex-col items-center rounded-3xl border border-dashed border-[var(--border)] bg-[var(--card)] px-8 py-14 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--qa-success-soft)] text-[var(--qa-success)]">
              <CheckCircle2 className="h-6 w-6" />
            </span>
            <p className="mt-4 text-sm font-medium text-[var(--foreground)]">
              Nothing overdue right now.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--card)]">
            <ul className="divide-y divide-[var(--border)]">
              {currentlyOverdue.map((c: any) => (
                <li key={c._id} className="flex items-center gap-4 px-5 py-4">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--destructive)]/15 text-[var(--destructive)]">
                    <Timer className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-mono text-xs text-[var(--foreground)]">
                      {c.ticketNumber}
                    </span>
                    <span className="mt-0.5 flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
                      <span>{c.assignedOfficeRef?.name ?? "—"}</span>
                      <span>·</span>
                      <span className="capitalize">{c.priority}</span>
                    </span>
                  </span>
                  <span className="shrink-0 text-xs font-semibold text-[var(--destructive)]">
                    Due {new Date(c.slaResolutionDueAt).toLocaleDateString()}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
