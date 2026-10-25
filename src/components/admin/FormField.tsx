"use client";
import { Children, cloneElement, isValidElement, useId, type ReactNode } from "react";
import { FormFieldContext } from "@/components/ui/form-field-context";

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
  const generatedId = useId();
  let controlId = htmlFor ?? `field-${generatedId}`;
  const hintId = `hint-${generatedId}`;
  const errorId = `error-${generatedId}`;
  const describedBy =
    [hint ? hintId : "", error ? errorId : ""].filter(Boolean).join(" ") || undefined;
  let connected = false;
  function connect(nodes: ReactNode): ReactNode {
    return Children.map(nodes, (node) => {
      if (!isValidElement<Record<string, any>>(node)) return node;
      if (
        !connected &&
        typeof node.type === "string" &&
        ["input", "textarea", "select"].includes(node.type) &&
        node.props.type !== "hidden"
      ) {
        connected = true;
        controlId = htmlFor ?? node.props.id ?? controlId;
        return cloneElement(node, {
          id: controlId,
          "aria-describedby":
            [node.props["aria-describedby"], describedBy].filter(Boolean).join(" ") || undefined,
          "aria-required": required || undefined,
          "aria-invalid": error ? true : node.props["aria-invalid"],
        });
      }
      return node.props.children
        ? cloneElement(node, { children: connect(node.props.children) })
        : node;
    });
  }
  const fields = connect(children);
  return (
    <FormFieldContext.Provider
      value={{
        id: controlId,
        labelId: `label-${generatedId}`,
        describedBy,
        required,
        invalid: Boolean(error),
      }}
    >
      <div className="space-y-1.5">
        <label
          id={`label-${generatedId}`}
          htmlFor={controlId}
          className="text-sm font-medium text-[var(--foreground)]"
        >
          {label}
          {required && (
            <span className="ml-1 text-[var(--destructive)]" aria-hidden="true">
              *
            </span>
          )}
        </label>
        {fields}
        {hint && (
          <p id={hintId} className="text-xs text-[var(--muted-foreground)]">
            {hint}
          </p>
        )}
        {error && (
          <p id={errorId} role="alert" className="text-xs font-medium text-[var(--destructive)]">
            {error}
          </p>
        )}
      </div>
    </FormFieldContext.Provider>
  );
}

export const inputClass =
  "w-full rounded-2xl border border-[var(--border)] bg-[var(--background)]/40 px-3.5 py-2.5 text-sm text-[var(--foreground)] outline-none transition-colors focus:border-[var(--ring)] focus:ring-1 focus:ring-[var(--ring)]";
