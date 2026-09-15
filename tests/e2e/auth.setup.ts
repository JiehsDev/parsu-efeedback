// tests/e2e/auth.setup.ts
//
// Playwright "setup project" (see playwright.config.ts's `setup` project,
// which every role-scoped project below depends on). Logs into the real
// /login UI (src/app/(public)/login/page.tsx) for each role and persists
// the resulting session cookie via `storageState` so the rest of the suite
// never has to pay the cost of a real sign-in per test.
//
// inactive@parsu.edu.ph is deliberately NOT logged in here — BR-005 needs
// that account to stay unauthenticated so auth.spec.ts can exercise the
// "deactivated account" rejection at login time.
import { test as setup, expect } from "@playwright/test";
import { homeRouteForRole } from "../../src/middleware/rbac";
import type { UserRole } from "../../src/lib/constants";

const PASSWORD = "ParSU_test2026";

const ROLES: Array<{ role: UserRole; email: string; storageFile: string }> = [
  { role: "student", email: "student@parsu.edu.ph", storageFile: "tests/e2e/.auth/student.json" },
  { role: "office_staff", email: "staff@parsu.edu.ph", storageFile: "tests/e2e/.auth/staff.json" },
  {
    role: "administrator",
    email: "admin@parsu.edu.ph",
    storageFile: "tests/e2e/.auth/admin.json",
  },
  { role: "vpaa", email: "vpaa@parsu.edu.ph", storageFile: "tests/e2e/.auth/vpaa.json" },
  { role: "vpaf", email: "vpaf@parsu.edu.ph", storageFile: "tests/e2e/.auth/vpaf.json" },
  { role: "osas", email: "osas@parsu.edu.ph", storageFile: "tests/e2e/.auth/osas.json" },
];

for (const { role, email, storageFile } of ROLES) {
  setup(`authenticate as ${role} (${email})`, async ({ page }) => {
    await page.goto("/login");

    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();

    await page.waitForURL(homeRouteForRole(role), { timeout: 30_000 });
    await expect(page).toHaveURL(homeRouteForRole(role));

    await page.context().storageState({ path: storageFile });
  });
}
