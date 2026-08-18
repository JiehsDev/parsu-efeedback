// src/app/(public)/register/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertCircle,
  BookOpen,
  Eye,
  EyeOff,
  Hash,
  Loader2,
  Lock,
  Mail,
  User,
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface College {
  _id: string;
  name: string;
  code: string;
}

const inputClass =
  "w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--background)]/40 py-2.5 pl-10 pr-3 text-base text-[var(--foreground)] outline-none transition-colors focus:border-[var(--ring)] focus:ring-1 focus:ring-[var(--ring)] sm:text-sm";
const labelClass = "text-sm font-medium text-[var(--foreground)]";

export default function RegisterPage() {
  const router = useRouter();

  const [colleges, setColleges] = useState<College[]>([]);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    studentNumber: "",
    collegeId: "",
    password: "",
    confirmPassword: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/colleges")
      .then((res) => res.json())
      .then((data) => setColleges(data.colleges ?? []))
      .catch(() => setColleges([]));
  }, []);

  function update(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
  }
  function extractErrorMessage(data: any): string {
    if (typeof data?.error === "string") {
      return data.error;
    }

    const fieldErrors = data?.error?.fieldErrors as Record<string, string[]> | undefined;
    if (fieldErrors) {
      const firstKey = Object.keys(fieldErrors)[0];
      if (firstKey && fieldErrors[firstKey]?.[0]) {
        return fieldErrors[firstKey][0];
      }
    }

    return "Registration failed.";
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(extractErrorMessage(data));
        setIsSubmitting(false);
        return;
      }

      router.push("/login?registered=true");
    } catch {
      setError("An unexpected system error occurred.");
      setIsSubmitting(false);
    }
  }

  return (
    <main className="w-full max-w-md">
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-xl shadow-black/20 sm:p-8">
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--foreground)]">
          Create your account
        </h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          ParSU e-Feedback — students only
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4" noValidate>
          {error && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-[var(--radius)] border border-[var(--destructive)]/40 bg-[var(--destructive)]/10 px-3 py-2.5 text-sm text-[var(--destructive)]"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="firstName" className={labelClass}>
                First name
              </label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
                <input
                  id="firstName"
                  autoComplete="given-name"
                  required
                  value={form.firstName}
                  onChange={update("firstName")}
                  className={inputClass}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="lastName" className={labelClass}>
                Last name
              </label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
                <input
                  id="lastName"
                  autoComplete="family-name"
                  required
                  value={form.lastName}
                  onChange={update("lastName")}
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="studentNumber" className={labelClass}>
              Student number
            </label>
            <div className="relative">
              <Hash className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
              <input
                id="studentNumber"
                autoComplete="off"
                required
                value={form.studentNumber}
                onChange={update("studentNumber")}
                placeholder="e.g. 2023-10492"
                className={inputClass}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="email" className={labelClass}>
              Email
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
              <input
                id="email"
                type="email"
                inputMode="email"
                autoCapitalize="none"
                autoCorrect="off"
                autoComplete="email"
                required
                value={form.email}
                onChange={update("email")}
                className={inputClass}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="collegeId" className={labelClass}>
              College
            </label>
            <div className="relative">
              <BookOpen className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
              <Select
                value={form.collegeId}
                onValueChange={(value) => setForm((prev) => ({ ...prev, collegeId: value }))}
              >
                <SelectTrigger id="collegeId" className="pl-10">
                  <SelectValue placeholder="Select your college" />
                </SelectTrigger>
                <SelectContent>
                  {colleges.map((college) => (
                    <SelectItem key={college._id} value={college._id}>
                      {college.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="password" className={labelClass}>
              Password
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                required
                value={form.password}
                onChange={update("password")}
                className={`${inputClass} pr-10`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                tabIndex={-1}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-xs text-[var(--muted-foreground)]">
              At least 8 characters, with at least one letter and one number.
            </p>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="confirmPassword" className={labelClass}>
              Confirm password
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
              <input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                autoComplete="new-password"
                required
                value={form.confirmPassword}
                onChange={update("confirmPassword")}
                className={`${inputClass} pr-10`}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((v) => !v)}
                tabIndex={-1}
                aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
              >
                {showConfirmPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="flex w-full items-center justify-center gap-2 rounded-[var(--radius)] bg-[var(--primary)] px-3 py-2.5 text-sm font-medium text-[var(--primary-foreground)] transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {isSubmitting ? "Creating account…" : "Create account"}
          </button>
        </form>
      </div>

      <p className="mt-6 text-center text-sm text-[var(--muted-foreground)]">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-[var(--primary)] hover:underline">
          Sign in
        </Link>
      </p>
    </main>
  );
}
