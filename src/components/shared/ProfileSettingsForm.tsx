// src/components/shared/ProfileSettingsForm.tsx
"use client";

import { clientFetch } from "@/lib/client-fetch";

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
  role: string;
}

const SECURITY_TIPS = [
  "Use a password you don't reuse anywhere else.",
  "Changing your password signs you out everywhere — you'll need to log in again.",
  "Never share your credentials with anyone else, staff included.",
];

export function ProfileSettingsForm({ roleLabel }: { roleLabel: string }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoadError, setProfileLoadError] = useState<string | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [emailCurrentPassword, setEmailCurrentPassword] = useState("");
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailSuccess, setEmailSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEmailSubmitting, setIsEmailSubmitting] = useState(false);

  useEffect(() => {
    async function loadProfile() {
      try {
        const response = await clientFetch("/api/me");
        const data = await response.json();
        if (!response.ok || !data.user) {
          throw new Error("Could not load profile.");
        }
        setProfile(data.user);
        setFirstName(data.user.firstName);
        setLastName(data.user.lastName);
        setNewEmail(data.user.email);
        setPendingEmail(data.pendingEmailChange?.email ?? null);
      } catch {
        setProfileLoadError("Could not load your profile. Check your connection and try again.");
      } finally {
        setIsLoadingProfile(false);
      }
    }
    void loadProfile();
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

    try {
      const res = await clientFetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(
          typeof data.error === "string"
            ? data.error
            : (data.errors?.[0]?.message ?? "Could not update profile."),
        );
        return;
      }

      setProfile((current) => (current ? { ...current, firstName, lastName } : current));
      setSuccess(
        newPassword
          ? "Profile updated. Please sign in again with your new password."
          : "Profile updated.",
      );
      setCurrentPassword("");
      setNewPassword("");
    } catch {
      setError("Could not update your profile. Check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleEmailSubmit(event: React.FormEvent) {
    event.preventDefault();
    setEmailError(null);
    setEmailSuccess(null);
    setIsEmailSubmitting(true);

    try {
      const response = await clientFetch("/api/me/email-change", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: newEmail,
          currentPassword: emailCurrentPassword,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setEmailError(
          typeof data.error === "string" ? data.error : "Could not request an email change.",
        );
        return;
      }
      setPendingEmail(data.pendingEmailChange.email);
      setEmailCurrentPassword("");
      setEmailSuccess(data.message);
    } catch {
      setEmailError("Could not request an email change. Check your connection and try again.");
    } finally {
      setIsEmailSubmitting(false);
    }
  }

  const inputClass =
    "w-full rounded-lg border border-[var(--border)] bg-[var(--background)]/40 py-2.5 pl-10 pr-3 text-sm text-[var(--foreground)] outline-none transition-colors focus:border-[var(--ring)] focus:ring-1 focus:ring-[var(--ring)]";

  if (!profile) {
    return (
      <div className="workspace-page">
        {profileLoadError ? (
          <p role="alert" className="text-sm text-[var(--destructive)]">
            {profileLoadError}
          </p>
        ) : (
          <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
            {isLoadingProfile && <Loader2 className="h-4 w-4 animate-spin" />}
            Loading profile…
          </div>
        )}
      </div>
    );
  }

  const affiliation = profile.officeRef?.name ?? profile.collegeRef?.name ?? null;
  const affiliationLabel = profile.officeRef ? "Office" : "College";

  return (
    <div className="workspace-page">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[var(--primary)]/15 text-[var(--primary)]">
          <UserRound className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">Profile</h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            Manage your account details and password.
          </p>
        </div>
      </div>

      <div className="reading-layout mt-8">
        <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-lg border border-[var(--destructive)]/40 bg-[var(--destructive)]/10 px-3 py-2.5 text-sm text-[var(--destructive)]"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            {success && (
              <div
                role="status"
                className="flex items-start gap-2 rounded-lg border border-[var(--qa-success-strong)]/30 bg-[var(--card)] px-3 py-2.5 text-sm text-[var(--qa-success-strong)]"
              >
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{success}</span>
              </div>
            )}

            <div>
              <p className="text-sm font-semibold text-[var(--foreground)]">Personal details</p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label
                    htmlFor="profile-firstName"
                    className="text-xs text-[var(--muted-foreground)]"
                  >
                    First name
                  </label>
                  <div className="relative">
                    <User className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
                    <input
                      id="profile-firstName"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label
                    htmlFor="profile-lastName"
                    className="text-xs text-[var(--muted-foreground)]"
                  >
                    Last name
                  </label>
                  <div className="relative">
                    <User className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
                    <input
                      id="profile-lastName"
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
                  <Lock className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
                  <label htmlFor="profile-CurrentPassword" className="sr-only">
                    Current password
                  </label>
                  <input
                    id="profile-CurrentPassword"
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
                    aria-label={showCurrentPassword ? "Hide password" : "Show password"}
                    className="absolute top-1/2 right-2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
                  >
                    {showCurrentPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                <div className="relative">
                  <KeyRound className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
                  <label htmlFor="profile-NewPassword" className="sr-only">
                    New password
                  </label>
                  <input
                    id="profile-NewPassword"
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
                    aria-label={showNewPassword ? "Hide password" : "Show password"}
                    className="absolute top-1/2 right-2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
                  >
                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-[var(--primary-foreground)] transition-opacity hover:opacity-90 disabled:opacity-50 sm:w-auto"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {isSubmitting ? "Saving…" : "Save Changes"}
            </button>
          </form>

          <form
            onSubmit={handleEmailSubmit}
            className="mt-6 space-y-4 border-t border-[var(--border)] pt-5"
          >
            <div>
              <p className="text-sm font-semibold text-[var(--foreground)]">Change email address</p>
              <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                Enter your current password. We’ll update your sign-in email after you confirm the
                link sent to the new address.
              </p>
            </div>

            {emailError && (
              <p
                role="alert"
                className="rounded-lg border border-[var(--destructive)]/40 bg-[var(--destructive)]/10 px-3 py-2.5 text-sm text-[var(--destructive)]"
              >
                {emailError}
              </p>
            )}
            {emailSuccess && (
              <p
                role="status"
                className="rounded-lg border border-[var(--qa-success-strong)]/30 bg-[var(--card)] px-3 py-2.5 text-sm text-[var(--qa-success-strong)]"
              >
                {emailSuccess}
              </p>
            )}
            {pendingEmail && (
              <p className="text-xs text-[var(--muted-foreground)]">
                Confirmation pending for <span className="font-medium">{pendingEmail}</span>. Your
                current email remains active until you confirm.
              </p>
            )}

            <div className="space-y-3">
              <div className="relative">
                <Mail className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
                <label htmlFor="profile-newEmail" className="sr-only">
                  New email address
                </label>
                <input
                  id="profile-newEmail"
                  type="email"
                  autoComplete="email"
                  required
                  maxLength={254}
                  value={newEmail}
                  onChange={(event) => setNewEmail(event.target.value)}
                  className={inputClass}
                />
              </div>
              <div className="relative">
                <Lock className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
                <label htmlFor="profile-emailCurrentPassword" className="sr-only">
                  Current password to change email
                </label>
                <input
                  id="profile-emailCurrentPassword"
                  type="password"
                  autoComplete="current-password"
                  placeholder="Current password"
                  required
                  value={emailCurrentPassword}
                  onChange={(event) => setEmailCurrentPassword(event.target.value)}
                  className={inputClass}
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={isEmailSubmitting}
              className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-[var(--border)] px-5 py-2.5 text-sm font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--muted)] disabled:opacity-50 sm:w-auto"
            >
              {isEmailSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEmailSubmitting ? "Sending…" : "Send confirmation"}
            </button>
          </form>
        </div>

        <div className="space-y-6">
          <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-5">
            <p className="text-sm font-semibold text-[var(--foreground)]">Account</p>
            <dl className="mt-4 space-y-4 text-sm">
              <div>
                <dt className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
                  <Hash className="h-3.5 w-3.5" />
                  {roleLabel} ID
                </dt>
                <dd className="mt-1.5 text-[var(--foreground)]">{profile.employeeOrStudentId}</dd>
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
              <div>
                <dt className="text-xs text-[var(--muted-foreground)]">Role</dt>
                <dd className="mt-1.5 text-[var(--foreground)]">{profile.role}</dd>
              </div>
            </dl>
            <p className="mt-4 border-t border-[var(--border)] pt-4 text-xs leading-relaxed text-[var(--muted-foreground)]">
              Your role, {roleLabel.toLowerCase()} ID, and office or college assignment are managed
              by an administrator.
            </p>
          </div>

          <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-5">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--qa-success-soft)] text-[var(--qa-success-strong)]">
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
