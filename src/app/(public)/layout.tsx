import Link from "next/link";
import { ThemeSwitcher } from "@/components/shared/ThemeSwitcher";
import { redirect } from "next/navigation";
import { BrandLogo } from "@/components/shared/BrandLogo";
import { auth } from "@/lib/auth";
import { homeRouteForRole } from "@/middleware/rbac";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  // The edge proxy intentionally allows guest routes through so revoked
  // sessions can still reach login. The Node auth check here distinguishes a
  // genuinely active session and keeps active users out of guest pages.
  const session = await auth();
  if (session?.user?.role) redirect(homeRouteForRole(session.user.role));

  return (
    <div className="flex min-h-full flex-1 flex-col lg:flex-row">
      {/* Brand panel â€” hidden on small screens so mobile goes straight to the form */}
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
          className="pointer-events-none absolute -top-24 -right-24 h-80 w-80 rounded-full bg-[var(--primary)]/20 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 -left-16 h-72 w-72 rounded-full bg-[var(--secondary)]/30 blur-3xl"
        />

        <Link href="/" className="relative flex items-center gap-2.5 text-white">
          <BrandLogo size={36} />
          <span className="text-base font-semibold tracking-tight">ParSU e-Feedback</span>
        </Link>

        <div className="relative mt-auto">
          <h2 className="max-w-sm text-3xl leading-tight font-semibold text-white xl:text-4xl">
            Student complaints and feedback
          </h2>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-white">
            Submit a concern to OSAS, follow its progress, and review the response.
          </p>
        </div>

        <p className="relative mt-12 text-xs text-white">
          &copy; {new Date().getFullYear()} Partido State University
        </p>
      </div>

      {/* Form panel */}
      <div className="relative flex flex-1 flex-col">
        <div className="absolute top-4 right-4 z-40">
          <ThemeSwitcher />
        </div>
        <div className="flex items-center gap-2.5 px-4 pt-6 sm:px-6 lg:hidden">
          <BrandLogo size={32} />
          <span className="text-sm font-semibold tracking-tight text-[var(--foreground)]">
            ParSU e-Feedback
          </span>
        </div>

        <div className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6">{children}</div>
      </div>
    </div>
  );
}
