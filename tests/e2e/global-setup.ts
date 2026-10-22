// Development-only reset: stable accounts/configuration and zero complaint tickets.
// Use an isolated test database when running this suite.
import type { FullConfig } from "@playwright/test";

export default async function globalSetup(config: FullConfig) {
  const baseURL =
    config.projects[0]?.use?.baseURL ?? process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

  const res = await fetch(new URL("/api/dev/seed", baseURL), {
    headers: process.env.DEV_SEED_SECRET
      ? { "x-dev-seed-secret": process.env.DEV_SEED_SECRET }
      : {},
  });

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
