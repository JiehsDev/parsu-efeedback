"use client";

import { useId } from "react";

/** Render the existing white mark without the JPG's baked-in purple background. */
export function BrandLogo({ size = 24 }: { size?: number }) {
  const filterId = `brand-mark-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;

  return (
    <span
      role="img"
      aria-label="ParSU e-Feedback logo"
      className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--navigation)]"
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 2000 2000" className="h-full w-full" aria-hidden="true" focusable="false">
        <defs>
          <filter id={filterId} colorInterpolationFilters="sRGB">
            {/* Purple has a low green channel; white has a high green channel.
                Convert that separation to alpha, keeping the original mark and
                antialiased edges while making the background transparent. */}
            <feColorMatrix
              type="matrix"
              values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 1.45 0 0 -0.45"
            />
          </filter>
        </defs>
        <image
          href="/new_logo.jpg"
          width="2000"
          height="2000"
          preserveAspectRatio="xMidYMid meet"
          filter={`url(#${filterId})`}
        />
      </svg>
    </span>
  );
}
