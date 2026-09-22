// src/components/admin/AdminUsersPageClient.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ChevronRight,
  Download,
  Loader2,
  Plus,
  Search,
  Users as UsersIcon,
} from "lucide-react";
import { Modal } from "@/components/admin/Modal";
import { FormField, inputClass } from "@/components/admin/FormField";
import { useToast } from "@/components/shared/Toast";
import { useConfirm } from "@/components/shared/ConfirmDialog";
import { ListRowsSkeleton } from "@/components/shared/Skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface UserRow {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  isActive: boolean;
  employeeOrStudentId: string;
  officeRef: { _id: string; name: string; code: string } | null;
  collegeRef: { _id: string; name: string; code: string } | null;
  officeHead: { _id: string; name: string } | null;
}

function affiliationLabel(u: UserRow): string {
  if (u.collegeRef) return u.collegeRef.name;
  if (u.officeRef) return u.officeRef.name;
  return "—";
}

function roleLabel(role: string): string {
  return { office_staff: "Office Staff", administrator: "Administrator", vpaa: "VPAA", vpaf: "VPAF", osas: "OSAS", student: "Student" }[role] ?? role;
}

interface Office {
  _id: string;
  name: string;
  code: string;
  type: string;
}

type ScopeKind = "all" | "college_office" | "university_office" | "student";

const ALL_ROLE_FILTER_OPTIONS = [
  { value: "", label: "All positions" },
  { value: "student", label: "Student" },
  { value: "office_staff", label: "Staff" },
  { value: "administrator", label: "Administrator" },
  { value: "vpaa", label: "VPAA" },
  { value: "vpaf", label: "VPAF" },
  { value: "osas", label: "OSAS" },
];

// Mirrors the server-side scope check in api/admin/users/route.ts's POST
// handler — which roles a sub-admin may even attempt to create/filter by.
function roleOptionsForScope(scopeKind: ScopeKind): string[] {
  if (scopeKind === "student") return ["student"];
  if (scopeKind === "college_office" || scopeKind === "university_office") {
    return ["office_staff"];
  }
  return ["student", "office_staff", "administrator", "vpaa", "vpaf", "osas"];
}

function defaultRoleForScope(scopeKind: ScopeKind): string {
  if (scopeKind === "student") return "student";
  return "office_staff";
}

const SORT_OPTIONS = [
  { value: "name", label: "Name (A–Z)" },
  { value: "newest", label: "Newest first" },
] as const;

export function AdminUsersPageClient({ scopeKind }: { scopeKind: ScopeKind }) {
  const { show: showToast } = useToast();
  const confirm = useConfirm();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [offices, setOffices] = useState<Office[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [search, setSearch] = useState("");
  const [officeFilter, setOfficeFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [sortBy, setSortBy] = useState<(typeof SORT_OPTIONS)[number]["value"]>("newest");
  const [isLoading, setIsLoading] = useState(true);

  const roleOptions = roleOptionsForScope(scopeKind);
  const roleFilterOptions =
    scopeKind === "all"
      ? ALL_ROLE_FILTER_OPTIONS
      : ALL_ROLE_FILTER_OPTIONS.filter((r) => !r.value || roleOptions.includes(r.value));
  const officeOptionsForRole =
    scopeKind === "college_office" || scopeKind === "university_office"
      ? offices.filter((o) => o.type === scopeKind)
      : offices;

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    employeeOrStudentId: "",
    password: "",
    role: defaultRoleForScope(scopeKind),
    officeRef: "",
    collegeRef: "",
  });

  function refreshUsers() {
    // limit=2000: the admin roster for one institution fits comfortably
    // under this, and it keeps every user in memory for the client-side
    // search/sort/filter below instead of only ever seeing the API's
    // default first page.
    fetch("/api/admin/users?limit=2000")
      .then((res) => res.json())
      .then((data) => {
        setUsers(data.users ?? []);
        setTotalUsers(data.total ?? 0);
      })
      .finally(() => setIsLoading(false));
  }

  useEffect(() => {
    refreshUsers();
    // The shared, unscoped /api/offices (not /api/admin/offices) — osas has
    // no Offices *management* access, but still needs the college list to
    // populate the "College" field when creating a student.
    fetch("/api/offices")
      .then((res) => res.json())
      .then((data) => setOffices(data.offices ?? []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const needsOffice = ["office_staff", "vpaa", "vpaf", "osas"].includes(form.role);
  const needsCollege = form.role === "student";
  const scopedOfficeCode = { vpaa: "OVPAA", vpaf: "OVPAF", osas: "OSAS" }[form.role as "vpaa" | "vpaf" | "osas"];
  const officeOptionsForSelectedRole = scopedOfficeCode
    ? officeOptionsForRole.filter((office) => office.code === scopedOfficeCode)
    : officeOptionsForRole;

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const payload: Record<string, unknown> = { ...form };
    if (!needsOffice) delete payload.officeRef;
    if (!needsCollege) delete payload.collegeRef;

    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Could not create user.");
      setIsSubmitting(false);
      return;
    }

    setShowCreate(false);
    setIsSubmitting(false);
    setForm({
      firstName: "",
      lastName: "",
      email: "",
      employeeOrStudentId: "",
      password: "",
      role: defaultRoleForScope(scopeKind),
      officeRef: "",
      collegeRef: "",
    });
    refreshUsers();
  }

  async function toggleActive(user: UserRow) {
    if (user.isActive) {
      const ok = await confirm({
        title: "Deactivate this user?",
        message: `${user.firstName} ${user.lastName} will immediately lose access — they won't be able to sign in until reactivated.`,
        confirmLabel: "Deactivate",
        danger: true,
      });
      if (!ok) return;
    }

    const res = await fetch(`/api/admin/users/${user._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !user.isActive }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      showToast(data.error ?? "Could not update user.", "error");
      return;
    }
    showToast(user.isActive ? "User deactivated" : "User activated");
    refreshUsers();
  }

  const visibleUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    let filtered = term
      ? users.filter((u) =>
          [`${u.firstName} ${u.lastName}`, u.email, u.employeeOrStudentId]
            .join(" ")
            .toLowerCase()
            .includes(term),
        )
      : users;

    if (officeFilter) {
      filtered = filtered.filter(
        (u) => u.officeRef?._id === officeFilter || u.collegeRef?._id === officeFilter,
      );
    }

    if (roleFilter) {
      filtered = filtered.filter((u) => u.role === roleFilter);
    }

    if (sortBy === "name") {
      return [...filtered].sort((a, b) =>
        `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`),
      );
    }
    return filtered;
  }, [users, search, officeFilter, roleFilter, sortBy]);

  function csvCell(value: string): string {
    return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
  }

  function handleExportCsv() {
    const header = ["First name", "Last name", "Email", "ID", "Role", "Affiliation", "Status"];
    const rows = visibleUsers.map((u) => [
      u.firstName,
      u.lastName,
      u.email,
      u.employeeOrStudentId,
      u.role.replace("_", " "),
      affiliationLabel(u),
      u.isActive ? "Active" : "Inactive",
    ]);
    const csv = [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `parsu-users-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--primary)]/15 text-[var(--primary)]">
            <UsersIcon className="h-5 w-5" />
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">Users</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCsv}
            disabled={visibleUsers.length === 0}
            className="flex items-center gap-2 rounded-full border border-[var(--border)] px-4 py-2.5 text-sm font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--muted)] disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 rounded-full bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-[var(--primary-foreground)] transition-opacity hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            Add User
          </button>
        </div>
      </div>

      {totalUsers > users.length && (
        <div className="flex items-start gap-2.5 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-400">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Showing the {users.length.toLocaleString()} most recent of {totalUsers.toLocaleString()}{" "}
            users. Narrow your search to find someone outside this range.
          </span>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-xs flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, or ID…"
            className="w-full rounded-2xl border border-[var(--border)] bg-[var(--card)] py-2.5 pr-3.5 pl-10 text-sm text-[var(--foreground)] transition-colors outline-none focus:border-[var(--ring)] focus:ring-1 focus:ring-[var(--ring)]"
          />
        </div>
        <div className="flex flex-wrap gap-3">
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-auto max-w-[9.5rem] bg-[var(--card)]">
              <SelectValue placeholder="All positions" />
            </SelectTrigger>
            <SelectContent>
              {roleFilterOptions.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={officeFilter} onValueChange={setOfficeFilter}>
            <SelectTrigger className="w-auto max-w-[11rem] bg-[var(--card)]">
              <SelectValue placeholder="All offices/colleges" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All offices/colleges</SelectItem>
              {officeOptionsForRole.map((o) => (
                <SelectItem key={o._id} value={o._id}>
                  {o.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={sortBy}
            onValueChange={(value) => setSortBy(value as (typeof SORT_OPTIONS)[number]["value"])}
          >
            <SelectTrigger className="w-auto bg-[var(--card)]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <ListRowsSkeleton />
      ) : visibleUsers.length === 0 ? (
        <div className="flex flex-col items-center rounded-3xl border border-dashed border-[var(--border)] bg-[var(--card)] px-8 py-14 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--muted)] text-[var(--muted-foreground)]">
            <UsersIcon className="h-6 w-6" />
          </span>
          <p className="mt-4 text-sm font-medium text-[var(--foreground)]">
            No users match this search.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--card)]">
          <ul className="divide-y divide-[var(--border)]">
            {visibleUsers.map((u) => (
              <li
                key={u._id}
                className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:gap-4"
              >
                <Link
                  href={`/admin/users/${u._id}`}
                  className="group flex min-w-0 flex-1 items-center gap-4 rounded-xl transition-colors hover:bg-[var(--muted)]/40"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--muted)] text-xs font-semibold text-[var(--muted-foreground)]">
                    {u.firstName[0]}
                    {u.lastName[0]}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-[var(--foreground)]">
                        {u.firstName} {u.lastName}
                      </span>
                      <span className="shrink-0 rounded-full bg-[var(--muted)] px-2 py-0.5 text-[10px] font-semibold tracking-wide text-[var(--muted-foreground)] uppercase">
                        {roleLabel(u.role)}
                      </span>
                      {u.officeHead && (
                        <span className="shrink-0 rounded-full bg-[var(--primary)]/15 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-[var(--primary)] uppercase">
                          Office Head
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-[var(--muted-foreground)]">
                      <span className="truncate">{u.email}</span>
                      <span>·</span>
                      <span className="shrink-0">{affiliationLabel(u)}</span>
                      <span>·</span>
                      <span className="shrink-0 font-mono">{u.employeeOrStudentId}</span>
                    </span>
                  </span>
                  <ChevronRight className="hidden h-4 w-4 shrink-0 text-[var(--muted-foreground)] opacity-0 transition-opacity group-hover:opacity-100 sm:block" />
                </Link>
                <div className="flex items-center gap-2 sm:shrink-0">
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
                      u.isActive
                        ? "bg-emerald-500/20 text-emerald-400"
                        : "bg-[var(--muted)] text-[var(--muted-foreground)]"
                    }`}
                  >
                    {u.isActive ? "Active" : "Inactive"}
                  </span>
                  <button
                    onClick={() => toggleActive(u)}
                    className="shrink-0 rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--muted)]"
                  >
                    {u.isActive ? "Deactivate" : "Activate"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {showCreate && (
        <Modal title="Add User" onClose={() => setShowCreate(false)}>
          <form onSubmit={handleCreate} className="space-y-4">
            {error && (
              <div className="flex items-start gap-2 rounded-2xl border border-[var(--destructive)]/40 bg-[var(--destructive)]/10 px-3 py-2 text-sm text-[var(--destructive)]">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <FormField label="First name" required>
                <input
                  required
                  className={inputClass}
                  value={form.firstName}
                  onChange={(e) => setForm((p) => ({ ...p, firstName: e.target.value }))}
                />
              </FormField>
              <FormField label="Last name" required>
                <input
                  required
                  className={inputClass}
                  value={form.lastName}
                  onChange={(e) => setForm((p) => ({ ...p, lastName: e.target.value }))}
                />
              </FormField>
            </div>

            <FormField label="Email" required>
              <input
                type="email"
                required
                className={inputClass}
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              />
            </FormField>

            <FormField label="Employee/Student ID" required>
              <input
                required
                className={inputClass}
                value={form.employeeOrStudentId}
                onChange={(e) => setForm((p) => ({ ...p, employeeOrStudentId: e.target.value }))}
              />
            </FormField>

            <FormField label="Password" required>
              <input
                type="password"
                required
                minLength={8}
                className={inputClass}
                value={form.password}
                onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
              />
            </FormField>

            <FormField label="Role" required>
              <Select
                value={form.role}
                onValueChange={(value) => setForm((p) => ({
                  ...p,
                  role: value,
                  officeRef: value === "student" || value === "administrator" ? "" : p.officeRef,
                  collegeRef: value === "student" ? p.collegeRef : "",
                }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    {roleOptions.map((r) => (
                    <SelectItem key={r} value={r}>
                      {roleLabel(r)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            {needsOffice && (
              <FormField label="Office">
                <Select
                  value={form.officeRef}
                  onValueChange={(value) => setForm((p) => ({ ...p, officeRef: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select office" />
                  </SelectTrigger>
                  <SelectContent>
                    {officeOptionsForSelectedRole.map((o) => (
                      <SelectItem key={o._id} value={o._id}>
                        {o.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            )}

            {needsCollege && (
              <FormField label="College">
                <Select
                  value={form.collegeRef}
                  onValueChange={(value) => setForm((p) => ({ ...p, collegeRef: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select college" />
                  </SelectTrigger>
                  <SelectContent>
                    {offices
                      .filter((o) => o.type === "college_office")
                      .map((o) => (
                        <SelectItem key={o._id} value={o._id}>
                          {o.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </FormField>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-[var(--primary)] px-3 py-2.5 text-sm font-semibold text-[var(--primary-foreground)] transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isSubmitting ? "Creating…" : "Create User"}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
