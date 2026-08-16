import Link from "next/link";
import { GraduationCap } from "lucide-react";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col lg:flex-row">
      {/* Brand panel — hidden on small screens so mobile goes straight to the form */}
      <div
        className="relative hidden overflow-hidden bg-gradient-to-br from-[#04121f] via-[#0a1f3d] to-[#0a50d8] lg:flex lg:w-[44%] lg:flex-col lg:justify-between lg:p-12 xl:p-16"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.08) 1px, transparent 0), linear-gradient(to bottom right, #04121f, #0a1f3d, #0a50d8)",
          backgroundSize: "28px 28px, 100% 100%",
        }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-[var(--primary)]/20 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 -left-16 h-72 w-72 rounded-full bg-[var(--secondary)]/30 blur-3xl"
        />

        <Link href="/" className="relative flex items-center gap-2.5 text-white">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/20">
            <GraduationCap className="h-5 w-5" />
          </span>
          <span className="text-base font-semibold tracking-tight">ParSU e-Feedback</span>
        </Link>

        <div className="relative mt-auto">
          <h2 className="max-w-sm text-3xl font-semibold leading-tight text-white xl:text-4xl">
            Heard. Handled. Resolved.
          </h2>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/70">
            One place for Partido State University students to raise concerns, track every
            update, and see them through to resolution.
          </p>
        </div>

        <p className="relative mt-12 text-xs text-white/40">
          © {new Date().getFullYear()} Partido State University
        </p>
      </div>

      {/* Form panel */}
      <div className="flex flex-1 flex-col">
        <div className="flex items-center gap-2.5 px-4 pt-6 sm:px-6 lg:hidden">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--primary)]/15 text-[var(--primary)] ring-1 ring-[var(--primary)]/30">
            <GraduationCap className="h-[18px] w-[18px]" />
          </span>
          <span className="text-sm font-semibold tracking-tight text-[var(--foreground)]">
            ParSU e-Feedback
          </span>
        </div>

        <div className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6">
          {children}
        </div>
      </div>
    </div>
  );
}
