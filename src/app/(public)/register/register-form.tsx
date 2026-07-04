"use client";

import { useActionState } from "react";
import Link from "next/link";
import { registerAction, type ActionResult } from "@/features/auth/actions";

const inputClass =
  "w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--ring)] focus:ring-1 focus:ring-[var(--ring)]";
const labelClass = "text-sm font-medium text-[var(--foreground)]";

interface RegisterFormProps {
  colleges: Array<{ id: string; name: string }>;
}

const initialState: ActionResult | undefined = undefined;

export function RegisterForm({ colleges }: RegisterFormProps) {
  const [state, formAction, isPending] = useActionState(registerAction, initialState);

  if (state?.success) {
    return (
      <div className="mt-8 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-4 text-sm text-[var(--foreground)]">
        <p>{state.message}</p>
        <Link href="/login" className="mt-3 inline-block text-[var(--primary)] hover:underline">
          Go to sign in →
        </Link>
      </div>
    );
  }

  const fieldErrors = state?.fieldErrors ?? {};

  return (
    <form action={formAction} className="mt-8 space-y-4" noValidate>
      {state && !state.success && !Object.keys(fieldErrors).length && (
        <div
          role="alert"
          className="rounded-[var(--radius)] border border-[var(--destructive)]/40 bg-[var(--destructive)]/10 px-3 py-2 text-sm text-[var(--destructive)]"
        >
          {state.message}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <Field
          id="firstName"
          label="First name"
          autoComplete="given-name"
          errors={fieldErrors.firstName}
        />
        <Field
          id="lastName"
          label="Last name"
          autoComplete="family-name"
          errors={fieldErrors.lastName}
        />
      </div>

      <Field
        id="email"
        label="Email"
        type="email"
        autoComplete="email"
        errors={fieldErrors.email}
      />

      <Field
        id="studentNumber"
        label="Student number"
        autoComplete="off"
        errors={fieldErrors.studentNumber}
      />

      <div className="space-y-1.5">
        <label htmlFor="collegeId" className={labelClass}>
          College
        </label>
        <select id="collegeId" name="collegeId" required className={inputClass} defaultValue="">
          <option value="" disabled>
            Select your college
          </option>
          {colleges.map((college) => (
            <option key={college.id} value={college.id}>
              {college.name}
            </option>
          ))}
        </select>
        {fieldErrors.collegeId?.map((message) => (
          <p key={message} className="text-xs text-[var(--destructive)]">
            {message}
          </p>
        ))}
      </div>

      <Field
        id="password"
        label="Password"
        type="password"
        autoComplete="new-password"
        errors={fieldErrors.password}
      />
      <Field
        id="confirmPassword"
        label="Confirm password"
        type="password"
        autoComplete="new-password"
        errors={fieldErrors.confirmPassword}
      />

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-[var(--radius)] bg-[var(--primary)] px-3 py-2 text-sm font-medium text-[var(--primary-foreground)] transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {isPending ? "Creating account…" : "Create account"}
      </button>

      <p className="text-center text-sm text-[var(--muted-foreground)]">
        Already have an account?{" "}
        <Link href="/login" className="text-[var(--primary)] hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}

function Field({
  id,
  label,
  type = "text",
  autoComplete,
  errors,
}: {
  id: string;
  label: string;
  type?: string;
  autoComplete?: string;
  errors?: string[];
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        autoComplete={autoComplete}
        required
        className={inputClass}
      />
      {errors?.map((message) => (
        <p key={message} className="text-xs text-[var(--destructive)]">
          {message}
        </p>
      ))}
    </div>
  );
}
