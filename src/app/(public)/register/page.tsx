// src/app/(public)/register/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface College {
  _id: string;
  name: string;
  code: string;
}

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
    <main className="flex min-h-full flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold text-[var(--foreground)]">Create an account</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          ParSU e-Feedback — Students only
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4" noValidate>
          {error && (
            <div
              role="alert"
              className="rounded-[var(--radius)] border border-[var(--destructive)]/40 bg-[var(--destructive)]/10 px-3 py-2 text-sm text-[var(--destructive)]"
            >
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="firstName" className="text-sm font-medium text-[var(--foreground)]">
                First name
              </label>
              <input
                id="firstName"
                required
                value={form.firstName}
                onChange={update("firstName")}
                className="w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--ring)] focus:ring-1 focus:ring-[var(--ring)]"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="lastName" className="text-sm font-medium text-[var(--foreground)]">
                Last name
              </label>
              <input
                id="lastName"
                required
                value={form.lastName}
                onChange={update("lastName")}
                className="w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--ring)] focus:ring-1 focus:ring-[var(--ring)]"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="studentNumber" className="text-sm font-medium text-[var(--foreground)]">
              Student number
            </label>
            <input
              id="studentNumber"
              required
              value={form.studentNumber}
              onChange={update("studentNumber")}
              placeholder="e.g. 2023-10492"
              className="w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--ring)] focus:ring-1 focus:ring-[var(--ring)]"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="email" className="text-sm font-medium text-[var(--foreground)]">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={form.email}
              onChange={update("email")}
              className="w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--ring)] focus:ring-1 focus:ring-[var(--ring)]"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="collegeId" className="text-sm font-medium text-[var(--foreground)]">
              College
            </label>
            <select
              id="collegeId"
              required
              value={form.collegeId}
              onChange={update("collegeId")}
              className="w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--ring)] focus:ring-1 focus:ring-[var(--ring)]"
            >
              <option value="" disabled>
                Select your college
              </option>
              {colleges.map((college) => (
                <option key={college._id} value={college._id}>
                  {college.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="password" className="text-sm font-medium text-[var(--foreground)]">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              value={form.password}
              onChange={update("password")}
              className="w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--ring)] focus:ring-1 focus:ring-[var(--ring)]"
            />
            <p className="text-xs text-[var(--muted-foreground)]">
              At least 8 characters, with at least one letter and one number.
            </p>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="confirmPassword"
              className="text-sm font-medium text-[var(--foreground)]"
            >
              Confirm password
            </label>
            <input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              value={form.confirmPassword}
              onChange={update("confirmPassword")}
              className="w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--ring)] focus:ring-1 focus:ring-[var(--ring)]"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-[var(--radius)] bg-[var(--primary)] px-3 py-2 text-sm font-medium text-[var(--primary-foreground)] transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {isSubmitting ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-[var(--muted-foreground)]">
          Already have an account?{" "}
          <Link href="/login" className="text-[var(--primary)] hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
