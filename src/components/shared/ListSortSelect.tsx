// src/components/shared/ListSortSelect.tsx
"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function ListSortSelect({
  options,
  paramName = "sort",
  placeholder,
}: {
  options: Array<{ value: string; label: string }>;
  paramName?: string;
  placeholder?: string;
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
    <Select value={current} onValueChange={handleChange}>
      <SelectTrigger className="w-auto min-w-40 bg-[var(--card)]">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
