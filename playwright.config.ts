// playwright.config.ts
//
// Phase 0 of the BR E2E suite (docs/business-rules.md BR-001..BR-100).
// See tests/e2e/global-setup.ts (seeds the DB once before the run) and
// tests/e2e/auth.setup.ts (logs in each role via the real /login UI, saves
// storageState) for the two pieces this config wires together.
//
// Role scoping is NOT done via Playwright "projects" — it's done per-test
// via the studentTest/staffTest/adminTest/vpaaTest/vpafTest/osasTest wrappers exported
// from tests/e2e/fixtures.ts (test.extend with a storageState fixture). That
// lets one spec file freely mix roles (e.g. assign as staff, then verify as
// student) without juggling multiple project runs. The "unauthenticated"
// specs (auth.spec.ts, rbac-redirects.spec.ts) import plain
// `test`/`expect` from @playwright/test directly, so they start with no
// storageState at all.
import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  timeout: 60_000,
  expect: { timeout: 10_000 },

  globalSetup: "./tests/e2e/global-setup.ts",

  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    ...devices["Desktop Chrome"],
  },

  // Dev server + first-compile-per-route can be slow in this repo (Next.js
  // 16, mongoose models cold-loading) — generous timeout, and reuse an
  // already-running `npm run dev` outside CI so repeated local runs don't
  // pay the cold-start cost every time.
  webServer: {
    command: "npm run dev",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },

  projects: [
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: "e2e",
      testMatch: /.*\.spec\.ts/,
      dependencies: ["setup"],
    },
  ],
});
