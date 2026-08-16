// src/components/shared/ListSearchInput.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

export function ListSearchInput({
  placeholder = "Search…",
  paramName = "q",
  className = "",
}: {
  placeholder?: string;
  paramName?: string;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlValue = searchParams.get(paramName) ?? "";
  const [value, setValue] = useState(urlValue);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setValue(urlValue);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlValue]);

  function handleChange(next: string) {
    setValue(next);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (next.trim()) params.set(paramName, next.trim());
      else params.delete(paramName);
      router.replace(params.toString() ? `${pathname}?${params}` : pathname);
    }, 350);
  }

  return (
    <div className={`relative ${className}`}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
      <input
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-[var(--border)] bg-[var(--card)] py-2.5 pl-10 pr-3.5 text-sm text-[var(--foreground)] outline-none transition-colors focus:border-[var(--ring)] focus:ring-1 focus:ring-[var(--ring)]"
      />
    </div>
  );
}
