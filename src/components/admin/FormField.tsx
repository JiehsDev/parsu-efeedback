// src/components/admin/FormField.tsx
export function FormField({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-[var(--foreground)]">{label}</label>
      {children}
      {hint && <p className="text-xs text-[var(--muted-foreground)]">{hint}</p>}
    </div>
  );
}

export const inputClass =
  "w-full rounded-2xl border border-[var(--border)] bg-[var(--background)]/40 px-3.5 py-2.5 text-sm text-[var(--foreground)] outline-none transition-colors focus:border-[var(--ring)] focus:ring-1 focus:ring-[var(--ring)]";
