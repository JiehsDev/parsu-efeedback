// src/app/admin/users/page.tsx
"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/admin/Modal";
import { FormField, inputClass } from "@/components/admin/FormField";

// src/app/admin/users/page.tsx — updated interface and table

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
}

// Small helper to show whichever applies, since a user only ever has one
function affiliationLabel(u: UserRow): string {
  if (u.collegeRef) return u.collegeRef.name;
  if (u.officeRef) return u.officeRef.name;
  return "—";
}

interface Office {
  _id: string;
  name: string;
  type: string;
}

const ROLES = ["student", "office_staff", "college_dean", "qa_office", "administrator"];

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [offices, setOffices] = useState<Office[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    employeeOrStudentId: "",
    password: "",
    role: "office_staff",
    officeRef: "",
    collegeRef: "",
  });

  const [isLoading, setIsLoading] = useState(true);

  function refreshUsers() {
    fetch("/api/admin/users")
      .then((res) => res.json())
      .then((data) => setUsers(data.users ?? []))
      .finally(() => setIsLoading(false));
  }

  useEffect(() => {
    refreshUsers();
    fetch("/api/admin/offices")
      .then((res) => res.json())
      .then((data) => setOffices(data.offices ?? []));
  }, []);

  const needsOffice = form.role === "office_staff" || form.role === "qa_office";
  const needsCollege = form.role === "student" || form.role === "college_dean";

  // And in handleCreate, fix the payload cleanup:
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
      role: "office_staff",
      officeRef: "",
      collegeRef: "",
    });
    refreshUsers();
  }

  async function toggleActive(user: UserRow) {
    await fetch(`/api/admin/users/${user._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !user.isActive }),
    });
    refreshUsers();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-[var(--foreground)]">Users</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="rounded-[var(--radius)] bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] hover:opacity-90"
        >
          + Add User
        </button>
      </div>

      <div className="overflow-hidden rounded-[var(--radius)] border border-[var(--border)]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--muted)] text-left text-[var(--muted-foreground)]">
            <tr>
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Email</th>
              <th className="px-4 py-2 font-medium">Role</th>
              <th className="px-4 py-2 font-medium">College / Office</th>
              <th className="px-4 py-2 font-medium">ID</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {users.map((u) => (
              <tr key={u._id} className="bg-[var(--card)]">
                <td className="px-4 py-3 text-[var(--foreground)]">
                  {u.firstName} {u.lastName}
                </td>
                <td className="px-4 py-3 text-[var(--muted-foreground)]">{u.email}</td>
                <td className="px-4 py-3 text-[var(--foreground)] capitalize">
                  {u.role.replace("_", " ")}
                </td>
                <td className="px-4 py-3 text-[var(--muted-foreground)]">{affiliationLabel(u)}</td>
                <td className="px-4 py-3 font-mono text-xs text-[var(--muted-foreground)]">
                  {u.employeeOrStudentId}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      u.isActive
                        ? "bg-emerald-500/20 text-emerald-400"
                        : "bg-[var(--muted)] text-[var(--muted-foreground)]"
                    }`}
                  >
                    {u.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => toggleActive(u)}
                    className="text-xs font-medium text-[var(--primary)] hover:underline"
                  >
                    {u.isActive ? "Deactivate" : "Activate"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <Modal title="Add User" onClose={() => setShowCreate(false)}>
          <form onSubmit={handleCreate} className="space-y-4">
            {error && <p className="text-sm text-[var(--destructive)]">{error}</p>}

            <div className="grid grid-cols-2 gap-3">
              <FormField label="First name">
                <input
                  required
                  className={inputClass}
                  value={form.firstName}
                  onChange={(e) => setForm((p) => ({ ...p, firstName: e.target.value }))}
                />
              </FormField>
              <FormField label="Last name">
                <input
                  required
                  className={inputClass}
                  value={form.lastName}
                  onChange={(e) => setForm((p) => ({ ...p, lastName: e.target.value }))}
                />
              </FormField>
            </div>

            <FormField label="Email">
              <input
                type="email"
                required
                className={inputClass}
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              />
            </FormField>

            <FormField label="Employee/Student ID">
              <input
                required
                className={inputClass}
                value={form.employeeOrStudentId}
                onChange={(e) => setForm((p) => ({ ...p, employeeOrStudentId: e.target.value }))}
              />
            </FormField>

            <FormField label="Password">
              <input
                type="password"
                required
                minLength={8}
                className={inputClass}
                value={form.password}
                onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
              />
            </FormField>

            <FormField label="Role">
              <select
                className={inputClass}
                value={form.role}
                onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r.replace("_", " ")}
                  </option>
                ))}
              </select>
            </FormField>

            {needsOffice && (
              <FormField label="Office">
                <select
                  required
                  className={inputClass}
                  value={form.officeRef}
                  onChange={(e) => setForm((p) => ({ ...p, officeRef: e.target.value }))}
                >
                  <option value="" disabled>
                    Select office
                  </option>
                  {offices.map((o) => (
                    <option key={o._id} value={o._id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </FormField>
            )}

            {needsCollege && (
              <FormField label="College">
                <select
                  required
                  className={inputClass}
                  value={form.collegeRef}
                  onChange={(e) => setForm((p) => ({ ...p, collegeRef: e.target.value }))}
                >
                  <option value="" disabled>
                    Select college
                  </option>
                  {offices
                    .filter((o) => o.type === "college")
                    .map((o) => (
                      <option key={o._id} value={o._id}>
                        {o.name}
                      </option>
                    ))}
                </select>
              </FormField>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-[var(--radius)] bg-[var(--primary)] px-3 py-2 text-sm font-medium text-[var(--primary-foreground)] hover:opacity-90 disabled:opacity-50"
            >
              {isSubmitting ? "Creating…" : "Create User"}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
