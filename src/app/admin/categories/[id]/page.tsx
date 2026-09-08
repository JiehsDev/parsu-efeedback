// src/app/admin/categories/[id]/page.tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import { Types } from "mongoose";
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  CheckCircle2,
  Flag,
  Route,
  Tag,
  Timer,
  XCircle,
} from "lucide-react";
import { connectToDatabase } from "@/lib/db";
import { auth } from "@/lib/auth";
import { Category } from "@/models/Category";
import { Office } from "@/models/Office";
import { RoutingRule } from "@/models/RoutingRule";
import { SLARule } from "@/models/SLARule";
import { CategoryStatusToggle } from "@/components/admin/CategoryStatusToggle";
import { EditCategoryButton } from "@/components/admin/EditCategoryButton";
import { EditRoutingRuleButton } from "@/components/admin/EditRoutingRuleButton";
import { EditSlaRuleButton } from "@/components/admin/EditSlaRuleButton";

export default async function AdminCategoryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) notFound();

  // Categories/Routing/SLA Rules are administrator-only — not exposed to
  // vpaa/vpaf/osas.
  const session = await auth();
  if (session?.user.role !== "administrator") notFound();

  await connectToDatabase();
  const category = await Category.findById(id).lean();
  if (!category) notFound();

  const c = category as any;

  const [defaultOffice, routingRule, slaRule, allOffices] = await Promise.all([
    c.defaultOfficeRef ? Office.findById(c.defaultOfficeRef).select("name code").lean() : null,
    RoutingRule.findOne({ categoryRef: id, isActive: true })
      .populate("targetOfficeRef", "name")
      .lean(),
    // A category only ever has one active SLA rule — its priority is fixed
    // to the category's own defaultPriority (see src/models/SLARule.ts).
    SLARule.findOne({ categoryRef: id, isActive: true })
      .populate("escalateToOfficeRef", "name")
      .lean(),
    Office.find().select("name").lean(),
  ]);

  const officeOptions = allOffices.map((o: any) => ({ _id: String(o._id), name: o.name }));

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link
        href="/admin/categories"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to categories
      </Link>

      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[var(--primary)]/15 text-[var(--primary)]">
            <Tag className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">
              {c.name}
            </h1>
            <div className="mt-1 flex items-center gap-2">
              <span className="rounded-full bg-[var(--muted)] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                {c.defaultPriority} priority
              </span>
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                  c.isActive
                    ? "bg-emerald-500/20 text-emerald-400"
                    : "bg-[var(--muted)] text-[var(--muted-foreground)]"
                }`}
              >
                {c.isActive ? "Active" : "Inactive"}
              </span>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <EditCategoryButton
            category={{
              _id: String(c._id),
              name: c.name,
              description: c.description,
            }}
          />
          <CategoryStatusToggle categoryId={String(c._id)} categoryName={c.name} isActive={c.isActive} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--secondary)]/15 text-[var(--secondary)]">
              <Flag className="h-[18px] w-[18px]" />
            </span>
            <p className="text-sm font-semibold text-[var(--foreground)]">Details</p>
          </div>
          <dl className="mt-4 space-y-4 text-sm">
            <div>
              <dt className="text-xs text-[var(--muted-foreground)]">Description</dt>
              <dd className="mt-1.5 text-[var(--foreground)]">{c.description || "—"}</dd>
            </div>
            <div>
              <dt className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
                <Building2 className="h-3.5 w-3.5" />
                Default office
              </dt>
              <dd className="mt-1.5 text-[var(--foreground)]">
                {defaultOffice ? (
                  <Link
                    href={`/admin/offices/${(defaultOffice as any)._id}`}
                    className="text-[var(--primary)] hover:underline"
                  >
                    {(defaultOffice as any).name}
                  </Link>
                ) : (
                  "—"
                )}
              </dd>
            </div>
          </dl>
        </div>

        <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400">
              <AlertTriangle className="h-[18px] w-[18px]" />
            </span>
            <p className="text-sm font-semibold text-[var(--foreground)]">Configuration Status</p>
          </div>
          <div className="mt-4 space-y-4 text-sm">
            <div className="flex items-start gap-2.5">
              {routingRule ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
              ) : (
                <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--destructive)]" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="flex items-center gap-1.5 font-medium text-[var(--foreground)]">
                    <Route className="h-3.5 w-3.5" />
                    Routing rule
                  </p>
                  <EditRoutingRuleButton
                    categoryId={String(c._id)}
                    rule={
                      routingRule
                        ? {
                            _id: String((routingRule as any)._id),
                            targetOfficeRef: String((routingRule as any).targetOfficeRef?._id),
                          }
                        : null
                    }
                    offices={officeOptions}
                  />
                </div>
                <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
                  {routingRule
                    ? `Routes to ${(routingRule as any).targetOfficeRef?.name ?? "—"}`
                    : "No active routing rule — this category can't be activated until one exists."}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              {slaRule ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
              ) : (
                <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--destructive)]" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="flex items-center gap-1.5 font-medium text-[var(--foreground)]">
                    <Timer className="h-3.5 w-3.5" />
                    SLA rule
                  </p>
                  <EditSlaRuleButton
                    categoryId={String(c._id)}
                    currentPriority={c.defaultPriority}
                    rule={
                      slaRule
                        ? {
                            _id: String((slaRule as any)._id),
                            responseHours: (slaRule as any).responseHours,
                            resolutionHours: (slaRule as any).resolutionHours,
                            escalateToOfficeRef: (slaRule as any).escalateToOfficeRef
                              ? String((slaRule as any).escalateToOfficeRef._id)
                              : null,
                          }
                        : null
                    }
                    offices={officeOptions}
                  />
                </div>
                <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
                  {slaRule
                    ? `Response ${(slaRule as any).responseHours}h · Resolution ${(slaRule as any).resolutionHours}h${
                        (slaRule as any).escalateToOfficeRef
                          ? ` · Escalates to ${(slaRule as any).escalateToOfficeRef.name}`
                          : ""
                      }`
                    : "No SLA rule of its own yet — falls back to the institution-wide default, if one exists for this priority."}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
