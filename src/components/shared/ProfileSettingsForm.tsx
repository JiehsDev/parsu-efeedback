// src/components/shared/ProfileSettingsForm.tsx
"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Eye,
  EyeOff,
  Hash,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  Save,
  ShieldCheck,
  User,
  UserRound,
} from "lucide-react";

interface Profile {
  firstName: string;
  lastName: string;
  email: string;
  employeeOrStudentId: string;
  officeRef: { name: string } | null;
  collegeRef: { name: string } | null;
}

const SECURITY_TIPS = [
  "Use a password you don't reuse anywhere else.",
  "Changing your password signs you out everywhere — you'll need to log in again.",
  "Never share your credentials with anyone else, staff included.",
];

export function ProfileSettingsForm({ roleLabel }: { roleLabel: string }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/me")
      .then((res) => res.json())
      .then((data) => {
        setProfile(data.user);
        setFirstName(data.user.firstName);
        setLastName(data.user.lastName);
      });
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setIsSubmitting(true);

    const payload: Record<string, unknown> = { firstName, lastName };
    if (newPassword) {
      payload.currentPassword = currentPassword;
      payload.newPassword = newPassword;
    }

    const res = await fetch("/api/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Could not update profile.");
      setIsSubmitting(false);
      return;
    }

    setSuccess(
      newPassword
        ? "Profile updated. Please sign in again with your new password."
        : "Profile updated.",
    );
    setCurrentPassword("");
    setNewPassword("");
    setIsSubmitting(false);
  }

  const inputClass =
    "w-full rounded-2xl border border-[var(--border)] bg-[var(--background)]/40 py-2.5 pl-10 pr-3 text-sm text-[var(--foreground)] outline-none transition-colors focus:border-[var(--ring)] focus:ring-1 focus:ring-[var(--ring)]";

  if (!profile) {
    return (
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading profile…
        </div>
      </div>
    );
  }

  const affiliation = profile.officeRef?.name ?? profile.collegeRef?.name ?? null;
  const affiliationLabel = profile.officeRef ? "Office" : "College";

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--primary)]/15 text-[var(--primary)]">
          <UserRound className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">Profile</h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            Manage your account details and password.
          </p>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-xl shadow-black/20 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-2xl border border-[var(--destructive)]/40 bg-[var(--destructive)]/10 px-3 py-2.5 text-sm text-[var(--destructive)]"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            {success && (
              <div className="flex items-start gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5 text-sm text-emerald-400">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{success}</span>
              </div>
            )}

            <div>
              <p className="text-sm font-semibold text-[var(--foreground)]">Personal details</p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs text-[var(--muted-foreground)]">First name</label>
                  <div className="relative">
                    <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
                    <input
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-[var(--muted-foreground)]">Last name</label>
                  <div className="relative">
                    <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
                    <input
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-[var(--border)] pt-5">
              <p className="text-sm font-semibold text-[var(--foreground)]">Change password</p>
              <p className="text-xs text-[var(--muted-foreground)]">
                Leave blank to keep your current password.
              </p>

              <div className="mt-3 space-y-3">
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
                  <input
                    type={showCurrentPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="Current password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className={`${inputClass} pr-10`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword((v) => !v)}
                    tabIndex={-1}
                    aria-label={showCurrentPassword ? "Hide password" : "Show password"}
                    className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
                  >
                    {showCurrentPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                <div className="relative">
                  <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
                  <input
                    type={showNewPassword ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="New password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className={`${inputClass} pr-10`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((v) => !v)}
                    tabIndex={-1}
                    aria-label={showNewPassword ? "Hide password" : "Show password"}
                    className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
                  >
                    {showNewPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-[var(--primary)] px-3 py-2.5 text-sm font-semibold text-[var(--primary-foreground)] transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {isSubmitting ? "Saving…" : "Save Changes"}
            </button>
          </form>
        </div>

        <div className="space-y-6">
          <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5">
            <p className="text-sm font-semibold text-[var(--foreground)]">Account</p>
            <dl className="mt-4 space-y-4 text-sm">
              <div>
                <dt className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
                  <Hash className="h-3.5 w-3.5" />
                  {roleLabel} ID
                </dt>
                <dd className="mt-1.5 text-[var(--foreground)]">
                  {profile.employeeOrStudentId}
                </dd>
              </div>
              <div>
                <dt className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
                  <Mail className="h-3.5 w-3.5" />
                  Email
                </dt>
                <dd className="mt-1.5 truncate text-[var(--foreground)]">{profile.email}</dd>
              </div>
              {affiliation && (
                <div>
                  <dt className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
                    <Building2 className="h-3.5 w-3.5" />
                    {affiliationLabel}
                  </dt>
                  <dd className="mt-1.5 text-[var(--foreground)]">{affiliation}</dd>
                </div>
              )}
            </dl>
          </div>

          <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
                <ShieldCheck className="h-[18px] w-[18px]" />
              </span>
              <p className="text-sm font-semibold text-[var(--foreground)]">Account security</p>
            </div>
            <ul className="mt-4 space-y-3">
              {SECURITY_TIPS.map((tip) => (
                <li
                  key={tip}
                  className="flex gap-2.5 text-xs leading-relaxed text-[var(--muted-foreground)]"
                >
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[var(--muted-foreground)]" />
                  {tip}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
