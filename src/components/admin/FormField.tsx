// src/components/admin/FormField.tsx
export function FormField({
  label,
  children,
  hint,
  required = false,
  error,
  htmlFor,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
  required?: boolean;
  error?: string;
  htmlFor?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-[var(--foreground)]">
        {label}
        {required && (
          <span className="ml-1 text-[var(--destructive)]" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {children}
      {hint && <p className="text-xs text-[var(--muted-foreground)]">{hint}</p>}
      {error && (
        <p role="alert" className="text-xs font-medium text-[var(--destructive)]">
          {error}
        </p>
      )}
    </div>
  );
}

export const inputClass =
  "w-full rounded-2xl border border-[var(--border)] bg-[var(--background)]/40 px-3.5 py-2.5 text-sm text-[var(--foreground)] outline-none transition-colors focus:border-[var(--ring)] focus:ring-1 focus:ring-[var(--ring)]";
