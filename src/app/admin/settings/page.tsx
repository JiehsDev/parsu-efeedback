// src/app/admin/settings/page.tsx
"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Hash,
  Loader2,
  Save,
  Settings as SettingsIcon,
  ShieldAlert,
  Upload,
} from "lucide-react";

interface SettingsData {
  ticketNumberPrefix: string;
  uploadMaxFileSizeMb: number;
  uploadAllowedMimeTypes: string[];
  authMaxFailedLoginAttempts: number;
  authLockoutDurationMinutes: number;
  authSessionMaxAgeMinutes: number;
}

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [mimeTypesInput, setMimeTypesInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((res) => res.json())
      .then((data) => {
        setSettings(data.settings);
        setMimeTypesInput(data.settings.uploadAllowedMimeTypes.join(", "));
      });
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!settings) return;
    setError(null);
    setSuccess(null);
    setIsSaving(true);

    const payload = {
      ...settings,
      uploadAllowedMimeTypes: mimeTypesInput
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    };

    const res = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Could not save settings.");
      setIsSaving(false);
      return;
    }

    setSettings(data.settings);
    setSuccess("Settings saved.");
    setIsSaving(false);
  }

  const inputClass =
    "w-full rounded-2xl border border-[var(--border)] bg-[var(--background)]/40 px-3.5 py-2.5 text-sm text-[var(--foreground)] outline-none transition-colors focus:border-[var(--ring)] focus:ring-1 focus:ring-[var(--ring)]";

  if (!settings) {
    return (
      <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--primary)]/15 text-[var(--primary)]">
          <SettingsIcon className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">
            System Settings
          </h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            Institution-wide configuration, editable without a redeploy.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="flex items-start gap-2 rounded-2xl border border-[var(--destructive)]/40 bg-[var(--destructive)]/10 px-3 py-2.5 text-sm text-[var(--destructive)]">
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

        <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--secondary)]/15 text-[var(--secondary)]">
              <Hash className="h-[18px] w-[18px]" />
            </span>
            <p className="text-sm font-semibold text-[var(--foreground)]">Ticket Numbering</p>
          </div>
          <div className="mt-4 space-y-1.5">
            <label className="text-xs text-[var(--muted-foreground)]">Prefix</label>
            <input
              value={settings.ticketNumberPrefix}
              onChange={(e) => setSettings({ ...settings, ticketNumberPrefix: e.target.value })}
              className={inputClass}
            />
            <p className="text-xs text-[var(--muted-foreground)]">
              e.g. "{settings.ticketNumberPrefix}-2026-000001"
            </p>
          </div>
        </div>

        <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--primary)]/15 text-[var(--primary)]">
              <Upload className="h-[18px] w-[18px]" />
            </span>
            <p className="text-sm font-semibold text-[var(--foreground)]">File Uploads</p>
          </div>
          <div className="mt-4 space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs text-[var(--muted-foreground)]">Max file size (MB)</label>
              <input
                type="number"
                min={1}
                value={settings.uploadMaxFileSizeMb}
                onChange={(e) =>
                  setSettings({ ...settings, uploadMaxFileSizeMb: Number(e.target.value) })
                }
                className={inputClass}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-[var(--muted-foreground)]">
                Allowed MIME types (comma-separated)
              </label>
              <input
                value={mimeTypesInput}
                onChange={(e) => setMimeTypesInput(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400">
              <ShieldAlert className="h-[18px] w-[18px]" />
            </span>
            <p className="text-sm font-semibold text-[var(--foreground)]">Authentication</p>
          </div>
          <div className="mt-3 flex items-start gap-2 rounded-2xl bg-amber-500/10 px-3 py-2.5 text-xs text-amber-400">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              Session timeout is set at server startup (Auth.js config) — changing it here does not
              take effect until the server restarts. Lockout settings apply to new login attempts
              immediately.
            </span>
          </div>
          <div className="mt-4 space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs text-[var(--muted-foreground)]">
                Max failed login attempts
              </label>
              <input
                type="number"
                min={1}
                value={settings.authMaxFailedLoginAttempts}
                onChange={(e) =>
                  setSettings({ ...settings, authMaxFailedLoginAttempts: Number(e.target.value) })
                }
                className={inputClass}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-[var(--muted-foreground)]">
                Lockout duration (minutes)
              </label>
              <input
                type="number"
                min={1}
                value={settings.authLockoutDurationMinutes}
                onChange={(e) =>
                  setSettings({ ...settings, authLockoutDurationMinutes: Number(e.target.value) })
                }
                className={inputClass}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-[var(--muted-foreground)]">
                Session max age (minutes) — requires restart
              </label>
              <input
                type="number"
                min={1}
                value={settings.authSessionMaxAgeMinutes}
                onChange={(e) =>
                  setSettings({ ...settings, authSessionMaxAgeMinutes: Number(e.target.value) })
                }
                className={inputClass}
              />
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={isSaving}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-[var(--primary)] px-3 py-2.5 text-sm font-semibold text-[var(--primary-foreground)] transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {isSaving ? "Saving…" : "Save Settings"}
        </button>
      </form>
    </div>
  );
}
