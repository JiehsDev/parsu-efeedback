// src/app/admin/categories/new/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Loader2,
  Route,
  Tag,
  Timer,
} from "lucide-react";
import { FormField, inputClass } from "@/components/admin/FormField";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DEFAULT_SLA_HOURS, type PriorityLevel } from "@/lib/constants";

const PRIORITIES = ["low", "medium", "high", "critical"];

const STEPS = [
  { label: "Category", icon: Tag },
  { label: "Routing Rule", icon: Route },
  { label: "SLA Rule", icon: Timer },
  { label: "Review", icon: CheckCircle2 },
];

interface Office {
  _id: string;
  name: string;
}

export default function NewCategoryWizardPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [offices, setOffices] = useState<Office[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Ids of what's already been created — populated as each step completes,
  // so going "Back" and forward again PATCHes the existing record instead
  // of creating a duplicate one.
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [routingRuleId, setRoutingRuleId] = useState<string | null>(null);
  const [slaRuleId, setSlaRuleId] = useState<string | null>(null);

  const [categoryForm, setCategoryForm] = useState({
    name: "",
    description: "",
    defaultPriority: "medium",
  });
  // Target office lives here, not on the category form — it's the same
  // question a routing rule already has to answer, so it's asked once,
  // at the step that actually governs where complaints land.
  const [routingForm, setRoutingForm] = useState({ targetOfficeRef: "" });
  // Priority lives here, not on the category form — a category's priority
  // only ever matters as "which SLA clock applies," so it's picked at the
  // same step as the hours it governs, not asked up front and then just
  // echoed back read-only later.
  const [slaForm, setSlaForm] = useState({
    priority: "medium",
    responseHours: DEFAULT_SLA_HOURS.medium.responseHours,
    resolutionHours: DEFAULT_SLA_HOURS.medium.resolutionHours,
    escalateToOfficeRef: "",
  });

  useEffect(() => {
    fetch("/api/admin/offices")
      .then((res) => res.json())
      .then((data) => setOffices(data.offices ?? []));
  }, []);

  async function handleCategorySubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const url = categoryId ? `/api/admin/categories/${categoryId}` : "/api/admin/categories";
    const res = await fetch(url, {
      method: categoryId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(categoryForm),
    });
    const data = await res.json();
    setIsSubmitting(false);

    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Could not save category.");
      return;
    }

    const id = String((categoryId ? data.category : data.category)._id);
    setCategoryId(id);
    setStep(2);
  }

  async function handleRoutingSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!categoryId) return;
    setError(null);
    setIsSubmitting(true);

    const url = routingRuleId
      ? `/api/admin/routing-rules/${routingRuleId}`
      : "/api/admin/routing-rules";
    const res = await fetch(url, {
      method: routingRuleId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categoryRef: categoryId, targetOfficeRef: routingForm.targetOfficeRef }),
    });
    const data = await res.json();
    setIsSubmitting(false);

    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Could not save routing rule.");
      return;
    }

    setRoutingRuleId(String(data.rule._id));
    setStep(3);
  }

  async function handleSlaSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!categoryId) return;
    setError(null);
    setIsSubmitting(true);

    const payload = {
      categoryRef: categoryId,
      priority: slaForm.priority,
      responseHours: Number(slaForm.responseHours),
      resolutionHours: Number(slaForm.resolutionHours),
      escalateToOfficeRef: slaForm.escalateToOfficeRef || null,
    };
    const url = slaRuleId ? `/api/admin/sla-rules/${slaRuleId}` : "/api/admin/sla-rules";
    const res = await fetch(url, {
      method: slaRuleId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    setIsSubmitting(false);

    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Could not save SLA rule.");
      return;
    }

    setSlaRuleId(String(data.rule._id));
    setStep(4);
  }

  async function handleActivate() {
    if (!categoryId) return;
    setError(null);
    setIsSubmitting(true);

    const res = await fetch(`/api/admin/categories/${categoryId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: true }),
    });
    const data = await res.json();
    setIsSubmitting(false);

    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Could not activate category.");
      return;
    }

    router.push(`/admin/categories/${categoryId}`);
  }

  const officeName = (id: string) => offices.find((o) => o._id === id)?.name ?? "—";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link
        href="/admin/categories"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to categories
      </Link>

      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">
          Set Up a New Category
        </h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          A category needs a routing rule and an SLA rule before it can go live — this walks
          through all three in order.
        </p>
      </div>

      {/* Stepper */}
      <div className="flex items-center">
        {STEPS.map((s, i) => {
          const stepNum = i + 1;
          const completed = stepNum < step;
          const current = stepNum === step;
          return (
            <div key={s.label} className="flex flex-1 items-center last:flex-none">
              <div className="flex flex-col items-center gap-1.5">
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition-colors ${
                    completed
                      ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                      : current
                        ? "bg-[var(--primary)]/15 text-[var(--primary)] ring-2 ring-[var(--primary)]"
                        : "bg-[var(--muted)] text-[var(--muted-foreground)]"
                  }`}
                >
                  {completed ? <Check className="h-4 w-4" /> : <s.icon className="h-4 w-4" />}
                </span>
                <span
                  className={`text-[11px] font-medium whitespace-nowrap ${
                    current || completed ? "text-[var(--foreground)]" : "text-[var(--muted-foreground)]"
                  }`}
                >
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <span
                  className={`mx-2 h-px flex-1 transition-colors ${
                    completed ? "bg-[var(--primary)]" : "bg-[var(--border)]"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6">
        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-2xl border border-[var(--destructive)]/40 bg-[var(--destructive)]/10 px-3 py-2.5 text-sm text-[var(--destructive)]">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {step === 1 && (
          <form onSubmit={handleCategorySubmit} className="space-y-4">
            <FormField label="Name">
              <input
                required
                placeholder="e.g. Academic Records Request"
                className={inputClass}
                value={categoryForm.name}
                onChange={(e) => setCategoryForm((p) => ({ ...p, name: e.target.value }))}
              />
            </FormField>
            <FormField label="Description">
              <textarea
                rows={2}
                placeholder="Optional — what kind of complaints belong in this category"
                className={inputClass}
                value={categoryForm.description}
                onChange={(e) => setCategoryForm((p) => ({ ...p, description: e.target.value }))}
              />
            </FormField>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-[var(--primary)] px-3 py-2.5 text-sm font-semibold text-[var(--primary-foreground)] transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {isSubmitting ? "Saving…" : "Next: Routing Rule"}
              {!isSubmitting && <ArrowRight className="h-4 w-4" />}
            </button>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={handleRoutingSubmit} className="space-y-4">
            <p className="text-sm text-[var(--muted-foreground)]">
              New complaints under <span className="font-medium text-[var(--foreground)]">{categoryForm.name}</span>{" "}
              will be routed here automatically.
            </p>
            <FormField label="Target office">
              <Select
                value={routingForm.targetOfficeRef}
                onValueChange={(value) => setRoutingForm({ targetOfficeRef: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select office" />
                </SelectTrigger>
                <SelectContent>
                  {offices.map((o) => (
                    <SelectItem key={o._id} value={o._id}>
                      {o.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex items-center justify-center gap-2 rounded-full border border-[var(--border)] px-4 py-2.5 text-sm font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--muted)]"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !routingForm.targetOfficeRef}
                className="flex flex-1 items-center justify-center gap-2 rounded-full bg-[var(--primary)] px-3 py-2.5 text-sm font-semibold text-[var(--primary-foreground)] transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {isSubmitting ? "Saving…" : "Next: SLA Rule"}
                {!isSubmitting && <ArrowRight className="h-4 w-4" />}
              </button>
            </div>
          </form>
        )}

        {step === 3 && (
          <form onSubmit={handleSlaSubmit} className="space-y-4">
            <p className="text-sm text-[var(--muted-foreground)]">
              Every complaint filed under{" "}
              <span className="font-medium text-[var(--foreground)]">{categoryForm.name}</span>{" "}
              gets this priority — set here, not on the category itself, since this is the only
              place it actually matters.
            </p>
            <FormField label="Priority">
              <Select
                value={slaForm.priority}
                onValueChange={(value) => {
                  const preset = DEFAULT_SLA_HOURS[value as PriorityLevel];
                  setSlaForm((p) => ({
                    ...p,
                    priority: value,
                    responseHours: preset.responseHours,
                    resolutionHours: preset.resolutionHours,
                  }));
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Response hours" hint="First-response deadline — defaults by priority, still editable">
                <input
                  type="number"
                  min={1}
                  required
                  className={inputClass}
                  value={slaForm.responseHours}
                  onChange={(e) =>
                    setSlaForm((p) => ({ ...p, responseHours: Number(e.target.value) }))
                  }
                />
              </FormField>
              <FormField label="Resolution hours" hint="Full-resolution deadline — defaults by priority, still editable">
                <input
                  type="number"
                  min={1}
                  required
                  className={inputClass}
                  value={slaForm.resolutionHours}
                  onChange={(e) =>
                    setSlaForm((p) => ({ ...p, resolutionHours: Number(e.target.value) }))
                  }
                />
              </FormField>
            </div>

            <FormField
              label="Escalate to office"
              hint="If the resolution deadline is breached, the complaint is reassigned here automatically"
            >
              <Select
                value={slaForm.escalateToOfficeRef}
                onValueChange={(value) => setSlaForm((p) => ({ ...p, escalateToOfficeRef: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="No escalation — stays at its assigned office" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No escalation — stays at its assigned office</SelectItem>
                  {offices.map((o) => (
                    <SelectItem key={o._id} value={o._id}>
                      {o.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="flex items-center justify-center gap-2 rounded-full border border-[var(--border)] px-4 py-2.5 text-sm font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--muted)]"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex flex-1 items-center justify-center gap-2 rounded-full bg-[var(--primary)] px-3 py-2.5 text-sm font-semibold text-[var(--primary-foreground)] transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {isSubmitting ? "Saving…" : "Review"}
                {!isSubmitting && <ArrowRight className="h-4 w-4" />}
              </button>
            </div>
          </form>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <div className="flex items-start gap-2.5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Category, routing rule, and SLA rule are all set. Ready to activate.</span>
            </div>

            <dl className="divide-y divide-[var(--border)] rounded-2xl border border-[var(--border)]">
              <div className="flex items-center justify-between px-4 py-3">
                <dt className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
                  <Tag className="h-3.5 w-3.5" />
                  Category
                </dt>
                <dd className="text-sm font-medium text-[var(--foreground)]">
                  {categoryForm.name}
                </dd>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <dt className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
                  <Route className="h-3.5 w-3.5" />
                  Routes to
                </dt>
                <dd className="text-sm font-medium text-[var(--foreground)]">
                  {officeName(routingForm.targetOfficeRef)}
                </dd>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <dt className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
                  <Timer className="h-3.5 w-3.5" />
                  SLA
                </dt>
                <dd className="text-sm font-medium text-[var(--foreground)] capitalize">
                  {slaForm.priority} — Response {slaForm.responseHours}h · Resolution{" "}
                  {slaForm.resolutionHours}h
                  {slaForm.escalateToOfficeRef && (
                    <> · Escalates to {officeName(slaForm.escalateToOfficeRef)}</>
                  )}
                </dd>
              </div>
            </dl>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep(3)}
                className="flex items-center justify-center gap-2 rounded-full border border-[var(--border)] px-4 py-2.5 text-sm font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--muted)]"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
              <button
                type="button"
                onClick={handleActivate}
                disabled={isSubmitting}
                className="flex flex-1 items-center justify-center gap-2 rounded-full bg-[var(--primary)] px-3 py-2.5 text-sm font-semibold text-[var(--primary-foreground)] transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {isSubmitting ? "Activating…" : "Activate Category"}
              </button>
            </div>
            <button
              type="button"
              onClick={() => router.push(`/admin/categories/${categoryId}`)}
              className="w-full text-center text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:underline"
            >
              Skip activation for now — review it later
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
