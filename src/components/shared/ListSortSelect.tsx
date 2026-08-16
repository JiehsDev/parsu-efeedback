// src/components/shared/ListSortSelect.tsx
"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronDown } from "lucide-react";

export function ListSortSelect({
  options,
  paramName = "sort",
}: {
  options: Array<{ value: string; label: string }>;
  paramName?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const defaultValue = options[0]?.value ?? "";
  const current = searchParams.get(paramName) ?? defaultValue;

  function handleChange(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (next && next !== defaultValue) params.set(paramName, next);
    else params.delete(paramName);
    router.replace(params.toString() ? `${pathname}?${params}` : pathname);
  }

  return (
    <div className="relative">
      <select
        value={current}
        onChange={(e) => handleChange(e.target.value)}
        className="appearance-none rounded-2xl border border-[var(--border)] bg-[var(--card)] py-2.5 pl-3.5 pr-9 text-sm text-[var(--foreground)] outline-none transition-colors focus:border-[var(--ring)] focus:ring-1 focus:ring-[var(--ring)]"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
    </div>
  );
}
