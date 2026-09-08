// src/app/admin/offices/[id]/page.tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import { Types } from "mongoose";
import { ArrowLeft, Building2, GitBranch, Hash, Tag, UserRound, Users } from "lucide-react";
import { connectToDatabase } from "@/lib/db";
import { auth } from "@/lib/auth";
import { Office } from "@/models/Office";
import { User } from "@/models/User";
import { OfficeStatusToggle } from "@/components/admin/OfficeStatusToggle";
import { EditOfficeButton } from "@/components/admin/EditOfficeButton";
import { getAdminScope } from "@/lib/admin-scope";

export default async function AdminOfficeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) notFound();

  await connectToDatabase();
  const session = await auth();
  const scope = getAdminScope(session!.user.role);
  if (scope.kind === "student") notFound();

  const office = await Office.findById(id).lean();
  if (!office) notFound();

  const o = office as any;
  if (
    (scope.kind === "college_office" || scope.kind === "university_office") &&
    o.type !== scope.kind
  ) {
    notFound();
  }

  // Students reference a college via collegeRef, not officeRef — this page
  // is about staffing, not enrollment, so students are excluded here (a
  // college can have hundreds; that list belongs on its own page, not
  // mixed into "who works here"). Staff belong to any office (college or
  // university) via officeRef uniformly.
  const ROLE_SORT_PRIORITY: Record<string, number> = {
    qa_office: 1,
    administrator: 1,
    office_staff: 2,
  };

  const [parentOffice, headUser, rawMembers] = await Promise.all([
    o.parentOffice ? Office.findById(o.parentOffice).select("name code").lean() : null,
    o.headUserRef ? User.findById(o.headUserRef).select("firstName lastName email").lean() : null,
    User.find({ officeRef: id, role: { $ne: "student" } })
      .select("firstName lastName email role isActive")
      .lean(),
  ]);

  const members = [...rawMembers].sort(
    (a: any, b: any) => (ROLE_SORT_PRIORITY[a.role] ?? 3) - (ROLE_SORT_PRIORITY[b.role] ?? 3),
  );

  const allOffices = await Office.find().select("name").lean();
  const officeOptions = allOffices.map((opt: any) => ({ _id: String(opt._id), name: opt.name }));

  // Only active staff already on this roster can become head — plus the
  // current head, even if they've since gone inactive, so the dropdown
  // never silently drops whoever is presently assigned.
  const memberOptions = members
    .filter((m: any) => m.isActive || String(m._id) === String(o.headUserRef))
    .map((m: any) => ({ _id: String(m._id), firstName: m.firstName, lastName: m.lastName }));

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link
        href="/admin/offices"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to offices
      </Link>

      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[var(--primary)]/15 text-[var(--primary)]">
            <Building2 className="h-6 w-6" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">
                {o.name}
              </h1>
              <span className="shrink-0 rounded-full bg-[var(--muted)] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                {o.type.replace("_", " ")}
              </span>
            </div>
            <div className="mt-1 flex items-center gap-2">
              <span className="font-mono text-xs text-[var(--muted-foreground)]">{o.code}</span>
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                  o.isActive
                    ? "bg-emerald-500/20 text-emerald-400"
                    : "bg-[var(--muted)] text-[var(--muted-foreground)]"
                }`}
              >
                {o.isActive ? "Active" : "Inactive"}
              </span>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <EditOfficeButton
            office={{ _id: String(o._id), name: o.name, code: o.code, type: o.type }}
            parentOfficeId={o.parentOffice ? String(o.parentOffice) : null}
            headUserId={o.headUserRef ? String(o.headUserRef) : null}
            officeOptions={officeOptions}
            memberOptions={memberOptions}
            scopeKind={scope.kind}
          />
          <OfficeStatusToggle officeId={String(o._id)} officeName={o.name} isActive={o.isActive} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--secondary)]/15 text-[var(--secondary)]">
              <Tag className="h-[18px] w-[18px]" />
            </span>
            <p className="text-sm font-semibold text-[var(--foreground)]">Details</p>
          </div>
          <dl className="mt-4 space-y-4 text-sm">
            <div>
              <dt className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
                <Hash className="h-3.5 w-3.5" />
                Code
              </dt>
              <dd className="mt-1.5 font-mono text-xs text-[var(--foreground)]">{o.code}</dd>
            </div>
            <div>
              <dt className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
                <GitBranch className="h-3.5 w-3.5" />
                Parent office
              </dt>
              <dd className="mt-1.5 text-[var(--foreground)]">
                {parentOffice ? (
                  <Link
                    href={`/admin/offices/${(parentOffice as any)._id}`}
                    className="text-[var(--primary)] hover:underline"
                  >
                    {(parentOffice as any).name}
                  </Link>
                ) : (
                  "—"
                )}
              </dd>
            </div>
            <div>
              <dt className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
                <UserRound className="h-3.5 w-3.5" />
                Office head
              </dt>
              <dd className="mt-1.5 text-[var(--foreground)]">
                {headUser
                  ? `${(headUser as any).firstName} ${(headUser as any).lastName}`
                  : "Not assigned"}
              </dd>
            </div>
          </dl>
        </div>

        <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--primary)]/15 text-[var(--primary)]">
              <Users className="h-[18px] w-[18px]" />
            </span>
            <p className="text-sm font-semibold text-[var(--foreground)]">
              Members ({members.length})
            </p>
          </div>
          {members.length === 0 ? (
            <p className="mt-4 text-sm text-[var(--muted-foreground)]">
              Nobody is assigned to this office yet.
            </p>
          ) : (
            <ul className="mt-4 max-h-80 space-y-1 overflow-y-auto">
              {members.map((m: any) => (
                <li key={m._id}>
                  <Link
                    href={`/admin/users/${m._id}`}
                    className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-[var(--muted)]/40"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--muted)] text-[10px] font-semibold text-[var(--muted-foreground)]">
                      {m.firstName[0]}
                      {m.lastName[0]}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-[var(--foreground)]">
                          {m.firstName} {m.lastName}
                        </span>
                        <span className="shrink-0 rounded-full bg-[var(--muted)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                          {m.role.replace("_", " ")}
                        </span>
                      </span>
                      <span className="block truncate text-xs text-[var(--muted-foreground)]">
                        {m.email}
                      </span>
                    </span>
                    {!m.isActive && (
                      <span className="shrink-0 rounded-full bg-[var(--muted)] px-2 py-0.5 text-[10px] font-medium text-[var(--muted-foreground)]">
                        Inactive
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
