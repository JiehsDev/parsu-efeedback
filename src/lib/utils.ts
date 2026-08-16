import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Escapes regex metacharacters so user input can be used safely inside a MongoDB $regex filter. */
export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const RELATIVE_UNITS: Array<{ limitSeconds: number; divisor: number; unit: string }> = [
  { limitSeconds: 60, divisor: 1, unit: "s" },
  { limitSeconds: 3600, divisor: 60, unit: "m" },
  { limitSeconds: 86400, divisor: 3600, unit: "h" },
  { limitSeconds: 604800, divisor: 86400, unit: "d" },
  { limitSeconds: 2629800, divisor: 604800, unit: "w" },
];

/**
 * "2h ago" / "in 3d" style relative time. Falls back to the localized date
 * once the gap exceeds ~a month, since "3mo ago" stops being useful for
 * scanning a list.
 */
export function formatRelativeTime(date: Date | string): string {
  const target = typeof date === "string" ? new Date(date) : date;
  const diffSeconds = (target.getTime() - Date.now()) / 1000;
  const abs = Math.abs(diffSeconds);
  const future = diffSeconds > 0;

  if (abs < 30) return "just now";

  for (const { limitSeconds, divisor, unit } of RELATIVE_UNITS) {
    if (abs < limitSeconds) {
      const value = Math.round(abs / divisor);
      return future ? `in ${value}${unit}` : `${value}${unit} ago`;
    }
  }

  return target.toLocaleDateString();
}
