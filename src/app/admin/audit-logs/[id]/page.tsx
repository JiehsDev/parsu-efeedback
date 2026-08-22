// src/app/admin/audit-logs/[id]/page.tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import { Types } from "mongoose";
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  Clock,
  Fingerprint,
  Globe,
  Monitor,
  ScrollText,
  UserRound,
} from "lucide-react";
import { connectToDatabase } from "@/lib/db";
import { AuditLog } from "@/models/AuditLog";
import { RelativeTime } from "@/components/shared/RelativeTime";

// Only entity types that actually have an admin detail route get a
// "View record" link — every other type (Complaint, Settings, SLARule,
// RoutingRule, GeneratedReport, ...) just shows its raw id, since linking
// to a page that doesn't exist would be worse than not linking at all.
const ENTITY_LINK_BUILDERS: Record<string, (id: string) => string> = {
  User: (id) => `/admin/users/${id}`,
  Office: (id) => `/admin/offices/${id}`,
  Category: (id) => `/admin/categories/${id}`,
};

// Every write handler names its action "<entity>.<verb>" (see
// src/features/audit-log/services/audit-log.service.ts callers) — the verb
// after the last dot is what actually distinguishes a create from a
// teardown, so tone is derived from that rather than a hardcoded list of
// every action string in the app.
function actionTone(action: string): { label: string; bg: string; text: string } {
  const verb = action.split(".").pop() ?? action;
  if (/^(create|generate)$/.test(verb)) {
    return { label: "Create", bg: "var(--qa-success-soft)", text: "var(--qa-success)" };
  }
  if (/^(delete|deactivate)$/.test(verb)) {
    return { label: "Remove", bg: "color-mix(in oklab, var(--destructive) 12%, var(--card))", text: "var(--destructive)" };
  }
  if (/escalate/.test(verb)) {
    return { label: "Escalate", bg: "var(--qa-amber-soft)", text: "var(--qa-amber)" };
  }
  if (/^(update|status_change)$/.test(verb)) {
    return { label: "Update", bg: "color-mix(in oklab, var(--primary) 12%, var(--card))", text: "var(--primary)" };
  }
  return { label: "Event", bg: "var(--muted)", text: "var(--muted-foreground)" };
}

// beforeState/afterState are whole lean-document snapshots (see the same
// service) — _id never changes and updatedAt changes on every write by
// definition, so both are pure noise in a field-by-field diff.
const DIFF_NOISE_FIELDS = new Set(["_id", "__v", "updatedAt"]);

function fieldLabel(key: string): string {
  return key
    .replace(/Ref$/, "")
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (value instanceof Date) return value.toLocaleString();
  if (typeof value === "object") {
    const asHex = (value as { toHexString?: () => string }).toHexString;
    if (typeof asHex === "function") return asHex.call(value);
    return JSON.stringify(value);
  }
  return String(value);
}

interface DiffRow {
  key: string;
  before: unknown;
  after: unknown;
}

function buildDiff(before: Record<string, unknown>, after: Record<string, unknown>): DiffRow[] {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const rows: DiffRow[] = [];
  for (const key of keys) {
    if (DIFF_NOISE_FIELDS.has(key)) continue;
    const b = before[key];
    const a = after[key];
    if (JSON.stringify(b ?? null) === JSON.stringify(a ?? null)) continue;
    rows.push({ key, before: b, after: a });
  }
  return rows.sort((x, y) => x.key.localeCompare(y.key));
}

function isPlainRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export default async function AuditLogDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) notFound();

  await connectToDatabase();
  const log = await AuditLog.findById(id)
    .populate("actorRef", "firstName lastName email role")
    .lean();

  if (!log) notFound();

  const l = log as any;
  const tone = actionTone(l.action);
  const entityIdStr = String(l.entityId);
  const entityHref = ENTITY_LINK_BUILDERS[l.entityType]?.(entityIdStr);
  const entityIsLinkable = Boolean(entityHref) && Types.ObjectId.isValid(entityIdStr);

  const before = isPlainRecord(l.beforeState) ? l.beforeState : null;
  const after = isPlainRecord(l.afterState) ? l.afterState : null;
  const diffRows = before && after ? buildDiff(before, after) : [];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link
        href="/admin/audit-logs"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to audit logs
      </Link>

      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[var(--muted)] text-[var(--muted-foreground)]">
            <ScrollText className="h-6 w-6" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-mono text-xl font-bold tracking-tight text-[var(--foreground)]">
                {l.action}
              </h1>
              <span
                className="shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase"
                style={{ background: tone.bg, color: tone.text }}
              >
                {tone.label}
              </span>
            </div>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              {l.entityType}
              {" · "}
              <span className="font-mono">{entityIdStr}</span>
              {entityIsLinkable && (
                <Link
                  href={entityHref!}
                  className="ml-2 inline-flex items-center gap-0.5 font-sans text-[var(--primary)] hover:underline"
                >
                  View record
                  <ArrowRight className="h-3 w-3" />
                </Link>
              )}
            </p>
          </div>
        </div>

        <div className="text-left sm:text-right">
          <p className="text-sm font-medium text-[var(--foreground)]">
            <RelativeTime date={l.createdAt} />
          </p>
          <p className="text-xs text-[var(--muted-foreground)]">
            {new Date(l.createdAt).toLocaleString()}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--primary)]/15 text-[var(--primary)]">
              {l.actorRef ? <UserRound className="h-[18px] w-[18px]" /> : <Bot className="h-[18px] w-[18px]" />}
            </span>
            <p className="text-sm font-semibold text-[var(--foreground)]">Performed by</p>
          </div>
          {l.actorRef ? (
            <dl className="mt-4 space-y-4 text-sm">
              <div>
                <dt className="text-xs text-[var(--muted-foreground)]">Name</dt>
                <dd className="mt-1.5 text-[var(--foreground)]">
                  {l.actorRef.firstName} {l.actorRef.lastName}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--muted-foreground)]">Email</dt>
                <dd className="mt-1.5 text-[var(--foreground)]">{l.actorRef.email}</dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--muted-foreground)]">Role</dt>
                <dd className="mt-1.5 text-[var(--foreground)] capitalize">
                  {String(l.actorRef.role).replace("_", " ")}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="mt-4 text-sm text-[var(--muted-foreground)]">
              No user was signed in for this action — it was written by a system process
              (e.g. the SLA cron or an automated escalation), not a person.
            </p>
          )}
        </div>

        <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--secondary)]/15 text-[var(--secondary)]">
              <Globe className="h-[18px] w-[18px]" />
            </span>
            <p className="text-sm font-semibold text-[var(--foreground)]">Request context</p>
          </div>
          <dl className="mt-4 space-y-4 text-sm">
            <div>
              <dt className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
                <Fingerprint className="h-3.5 w-3.5" />
                IP address
              </dt>
              <dd className="mt-1.5 font-mono text-xs text-[var(--foreground)]">
                {l.ipAddress || "—"}
              </dd>
            </div>
            <div>
              <dt className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
                <Monitor className="h-3.5 w-3.5" />
                User agent
              </dt>
              <dd className="mt-1.5 font-mono text-xs break-all text-[var(--foreground)]">
                {l.userAgent || "—"}
              </dd>
            </div>
            <div>
              <dt className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
                <Clock className="h-3.5 w-3.5" />
                Logged at
              </dt>
              <dd className="mt-1.5 text-[var(--foreground)]">
                {new Date(l.createdAt).toLocaleString()}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6">
        <p className="text-sm font-semibold text-[var(--foreground)]">What changed</p>

        {!before && !after && (
          <p className="mt-3 text-sm text-[var(--muted-foreground)]">
            No before/after state was recorded for this action.
          </p>
        )}

        {before && !after && (
          <>
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">
              State immediately before this record was removed.
            </p>
            <dl className="mt-4 divide-y divide-[var(--border)]">
              {Object.entries(before)
                .filter(([key]) => !DIFF_NOISE_FIELDS.has(key))
                .map(([key, value]) => (
                  <div key={key} className="flex items-start justify-between gap-4 py-2 text-sm">
                    <dt className="shrink-0 text-[var(--muted-foreground)]">{fieldLabel(key)}</dt>
                    <dd className="text-right font-mono text-xs text-[var(--foreground)]">
                      {formatValue(value)}
                    </dd>
                  </div>
                ))}
            </dl>
          </>
        )}

        {!before && after && (
          <>
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">
              Initial values this record was created with.
            </p>
            <dl className="mt-4 divide-y divide-[var(--border)]">
              {Object.entries(after)
                .filter(([key]) => !DIFF_NOISE_FIELDS.has(key))
                .map(([key, value]) => (
                  <div key={key} className="flex items-start justify-between gap-4 py-2 text-sm">
                    <dt className="shrink-0 text-[var(--muted-foreground)]">{fieldLabel(key)}</dt>
                    <dd className="text-right font-mono text-xs text-[var(--foreground)]">
                      {formatValue(value)}
                    </dd>
                  </div>
                ))}
            </dl>
          </>
        )}

        {before && after && (
          <>
            {diffRows.length === 0 ? (
              <p className="mt-3 text-sm text-[var(--muted-foreground)]">
                Nothing in the tracked fields differs between before and after.
              </p>
            ) : (
              <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--border)]">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)] bg-[var(--muted)]/40 text-left text-xs text-[var(--muted-foreground)] uppercase tracking-wide">
                      <th className="px-4 py-2.5 font-semibold">Field</th>
                      <th className="px-4 py-2.5 font-semibold">Before</th>
                      <th className="px-4 py-2.5 font-semibold">After</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {diffRows.map((row) => (
                      <tr key={row.key}>
                        <td className="px-4 py-2.5 align-top text-[var(--foreground)]">
                          {fieldLabel(row.key)}
                        </td>
                        <td
                          className="px-4 py-2.5 align-top font-mono text-xs break-all"
                          style={{ color: "var(--destructive)" }}
                        >
                          {formatValue(row.before)}
                        </td>
                        <td
                          className="px-4 py-2.5 align-top font-mono text-xs break-all"
                          style={{ color: "var(--qa-success)" }}
                        >
                          {formatValue(row.after)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {(before || after) && (
          <details className="mt-4 group">
            <summary className="cursor-pointer text-xs font-medium text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]">
              View raw JSON snapshots
            </summary>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <p className="mb-1.5 text-[10px] font-semibold tracking-wide text-[var(--muted-foreground)] uppercase">
                  Before
                </p>
                <pre className="max-h-72 overflow-auto rounded-xl bg-[var(--muted)]/50 p-3 font-mono text-[11px] text-[var(--foreground)]">
                  {before ? JSON.stringify(before, null, 2) : "null"}
                </pre>
              </div>
              <div>
                <p className="mb-1.5 text-[10px] font-semibold tracking-wide text-[var(--muted-foreground)] uppercase">
                  After
                </p>
                <pre className="max-h-72 overflow-auto rounded-xl bg-[var(--muted)]/50 p-3 font-mono text-[11px] text-[var(--foreground)]">
                  {after ? JSON.stringify(after, null, 2) : "null"}
                </pre>
              </div>
            </div>
          </details>
        )}
      </div>
    </div>
  );
}
