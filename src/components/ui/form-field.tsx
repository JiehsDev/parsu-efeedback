import type { ReactNode } from "react";

export function FieldLabel({
  htmlFor,
  children,
  required = false,
  optional = false,
  className = "",
}: {
  htmlFor?: string;
  children: ReactNode;
  required?: boolean;
  optional?: boolean;
  className?: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className={`text-sm font-medium text-[var(--foreground)] ${className}`}
    >
      {children}
      {required && (
        <span className="ml-1 text-[var(--destructive)]" aria-hidden="true">
          *
        </span>
      )}
      {optional && (
        <span className="ml-1 text-xs font-normal text-[var(--muted-foreground)]">(optional)</span>
      )}
    </label>
  );
}

export function FieldError({ id, message }: { id: string; message?: string | null }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="text-xs font-medium text-[var(--destructive)]">
      {message}
    </p>
  );
}

export const invalidControlClass =
  "aria-[invalid=true]:border-[var(--destructive)] aria-[invalid=true]:focus:border-[var(--destructive)] aria-[invalid=true]:focus:ring-[var(--destructive)]";

export function focusFirstInvalid(form: Element) {
  const first = form.querySelector<HTMLElement>('[aria-invalid="true"]');
  first?.scrollIntoView({ behavior: "smooth", block: "center" });
  first?.focus({ preventScroll: true });
}
