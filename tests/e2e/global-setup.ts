// tests/e2e/global-setup.ts
//
// Runs once before the whole Playwright run (wired via playwright.config.ts
// `globalSetup`). Hits the dev-only seed endpoint (src/app/api/dev/seed/
// route.ts) so every spec runs against a known, freshly-reset data set:
// known accounts (student@parsu.edu.ph, staff@parsu.edu.ph..staff17, dean@,
// qa@, admin@, inactive@ — all password ParSU_test2026; every office has
// both a head and at least one ordinary staff account), colleges/offices,
// 13 submittable categories, 300 complaints, 24 feedback rows, plus a few
// seeded InformationRequest/ArchiveRequest rows so those states aren't empty.
//
// The seed route unconditionally clears every collection first, so this
// must run exactly once per suite run, before any spec (including
// auth.setup.ts) touches the app — never mid-run, or it would blow away
// state a still-running test depends on.
import type { FullConfig } from "@playwright/test";

export default async function globalSetup(config: FullConfig) {
  const baseURL =
    config.projects[0]?.use?.baseURL ?? process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

  const res = await fetch(new URL("/api/dev/seed", baseURL));

  if (!res.ok) {
    const body = await res.text().catch(() => "<no body>");
    throw new Error(
      `global-setup: GET /api/dev/seed failed (${res.status} ${res.statusText}). ` +
        `The E2E suite cannot run against unseeded/unknown data. Response body: ${body}`,
    );
  }

  const data = await res.json().catch(() => null);
  // eslint-disable-next-line no-console
  console.log("[global-setup] Seed OK:", data?.counts ?? data);
}
