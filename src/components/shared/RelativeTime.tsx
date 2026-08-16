// src/components/shared/RelativeTime.tsx
"use client";

import { useEffect, useState } from "react";
import { formatRelativeTime } from "@/lib/utils";

export function RelativeTime({
  date,
  className = "",
}: {
  date: Date | string;
  className?: string;
}) {
  // Rendered once on the server (or with whatever time the client mounts
  // at) and corrected/ticked forward client-side — relative time depends
  // on "now", which the server and client will never quite agree on, so
  // this intentionally re-renders after mount rather than trusting SSR.
  const [text, setText] = useState(() => formatRelativeTime(date));

  useEffect(() => {
    setText(formatRelativeTime(date));
    const id = setInterval(() => setText(formatRelativeTime(date)), 60_000);
    return () => clearInterval(id);
  }, [date]);

  const full = (typeof date === "string" ? new Date(date) : date).toLocaleString();

  return (
    <time
      dateTime={new Date(date).toISOString()}
      title={full}
      className={className}
      suppressHydrationWarning
    >
      {text}
    </time>
  );
}
