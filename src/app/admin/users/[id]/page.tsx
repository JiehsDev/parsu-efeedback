// src/app/admin/users/[id]/page.tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import { Types } from "mongoose";
import {
  ArrowLeft,
  Building2,
  Calendar,
  Clock,
  Hash,
  KeyRound,
  Lock,
  Mail,
  ShieldAlert,
  UserRound,
} from "lucide-react";
import { connectToDatabase } from "@/lib/db";
import { User } from "@/models/User";
import { Office } from "@/models/Office";
import { UserStatusToggle } from "@/components/admin/UserStatusToggle";
import { EditUserButton } from "@/components/admin/EditUserButton";
import { ForceLogoutButton } from "@/components/admin/ForceLogoutButton";
import { RelativeTime } from "@/components/shared/RelativeTime";

function getInitials(firstName: string, lastName: string): string {
  return `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase();
}

function affiliationLabel(u: any): string {
  if (u.collegeRef) return u.collegeRef.name;
  if (u.officeRef) return u.officeRef.name;
  return "—";
}

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) notFound();

  await connectToDatabase();
  const user = await User.findById(id)
    .select("-passwordHash")
    .populate("officeRef", "name code type")
    .populate("collegeRef", "name code type")
    .lean();

  if (!user) notFound();

  const u = user as any;
  const isLocked = u.lockedUntil && new Date(u.lockedUntil) > new Date();

  const offices = await Office.find().select("name type").lean();
  const editableUser = {
    _id: String(u._id),
    firstName: u.firstName,
    lastName: u.lastName,
    email: u.email,
    role: u.role,
    officeRef: u.officeRef ? { _id: String(u.officeRef._id) } : null,
    collegeRef: u.collegeRef ? { _id: String(u.collegeRef._id) } : null,
  };
  const officeOptions = offices.map((o: any) => ({
    _id: String(o._id),
    name: o.name,
    type: o.type,
  }));

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link
        href="/admin/users"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to users
      </Link>

      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[var(--muted)] text-lg font-semibold text-[var(--muted-foreground)]">
            {getInitials(u.firstName, u.lastName)}
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">
                {u.firstName} {u.lastName}
              </h1>
              <span className="shrink-0 rounded-full bg-[var(--muted)] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                {u.role.replace("_", " ")}
              </span>
            </div>
            <div className="mt-1 flex items-center gap-2">
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                  u.isActive
                    ? "bg-emerald-500/20 text-emerald-400"
                    : "bg-[var(--muted)] text-[var(--muted-foreground)]"
                }`}
              >
                {u.isActive ? "Active" : "Inactive"}
              </span>
              {isLocked && (
                <span className="flex items-center gap-1 rounded-full bg-[var(--destructive)]/15 px-2.5 py-1 text-xs font-medium text-[var(--destructive)]">
                  <Lock className="h-3 w-3" />
                  Locked
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <EditUserButton user={editableUser} offices={officeOptions} />
          <UserStatusToggle
            userId={String(u._id)}
            userName={`${u.firstName} ${u.lastName}`}
            isActive={u.isActive}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--primary)]/15 text-[var(--primary)]">
              <UserRound className="h-[18px] w-[18px]" />
            </span>
            <p className="text-sm font-semibold text-[var(--foreground)]">Identity</p>
          </div>
          <dl className="mt-4 space-y-4 text-sm">
            <div>
              <dt className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
                <Mail className="h-3.5 w-3.5" />
                Email
              </dt>
              <dd className="mt-1.5 text-[var(--foreground)]">{u.email}</dd>
            </div>
            <div>
              <dt className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
                <Hash className="h-3.5 w-3.5" />
                Employee / Student ID
              </dt>
              <dd className="mt-1.5 font-mono text-xs text-[var(--foreground)]">
                {u.employeeOrStudentId}
              </dd>
            </div>
            <div>
              <dt className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
                <Building2 className="h-3.5 w-3.5" />
                {u.collegeRef ? "College" : "Office"}
              </dt>
              <dd className="mt-1.5 text-[var(--foreground)]">{affiliationLabel(u)}</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--secondary)]/15 text-[var(--secondary)]">
              <ShieldAlert className="h-[18px] w-[18px]" />
            </span>
            <p className="text-sm font-semibold text-[var(--foreground)]">Account Security</p>
          </div>
          <dl className="mt-4 space-y-4 text-sm">
            <div>
              <dt className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
                <Calendar className="h-3.5 w-3.5" />
                Account created
              </dt>
              <dd className="mt-1.5 text-[var(--foreground)]">
                <RelativeTime date={u.createdAt} />
              </dd>
            </div>
            <div>
              <dt className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
                <Clock className="h-3.5 w-3.5" />
                Last login
              </dt>
              <dd className="mt-1.5 text-[var(--foreground)]">
                {u.lastLoginAt ? <RelativeTime date={u.lastLoginAt} /> : "Never signed in"}
              </dd>
            </div>
            <div>
              <dt className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
                <KeyRound className="h-3.5 w-3.5" />
                Password last changed
              </dt>
              <dd className="mt-1.5 text-[var(--foreground)]">
                {u.passwordChangedAt ? <RelativeTime date={u.passwordChangedAt} /> : "—"}
              </dd>
            </div>
            <div>
              <dt className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
                <Lock className="h-3.5 w-3.5" />
                Failed login attempts
              </dt>
              <dd className="mt-1.5 text-[var(--foreground)]">
                {u.failedLoginAttempts}
                {isLocked && (
                  <span className="ml-2 text-xs text-[var(--destructive)]">
                    Locked until <RelativeTime date={u.lockedUntil} />
                  </span>
                )}
              </dd>
            </div>
          </dl>

          <div className="mt-5 border-t border-[var(--border)] pt-4">
            <p className="text-xs text-[var(--muted-foreground)]">
              Signs this account out of every device immediately, without changing the password.
            </p>
            <div className="mt-2.5">
              <ForceLogoutButton userId={String(u._id)} userName={`${u.firstName} ${u.lastName}`} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
