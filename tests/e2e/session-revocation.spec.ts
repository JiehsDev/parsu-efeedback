// tests/e2e/session-revocation.spec.ts — BR-084, BR-097
//
// src/lib/auth.ts's `auth()` (the one every Route Handler/Server Component
// imports — never next-auth's own `auth` directly) re-checks `isActive`/
// `tokenVersion` against the DB on every call. The edge-only proxy
// (src/proxy.ts) can't do this (no DB access at the edge) and trusts the
// JWT's claims as of when it was issued — so a still-validly-signed session
// for a user an admin just deactivated must still be rejected once it
// reaches a Node-runtime page/route, proving the DB re-check is real
// defense-in-depth and not just redirect-based cosmetic gating.
//
// Uses staff3@parsu.edu.ph specifically: not one of the five storageState
// fixtures in tests/e2e/auth.setup.ts, and not touched by any other spec —
// safe to deactivate permanently for the rest of the suite run.
import { adminTest, expect } from "./fixtures";
import { loginAs } from "./helpers";

adminTest.describe("Session revocation", () => {
  adminTest(
    "BR-084/097: deactivating a user immediately revokes access even with a still-validly-signed JWT",
    async ({ page, browser }) => {
      // --- 1. Capture staff3's session BEFORE admin deactivates them. ---
      const staff3Context = await browser.newContext();
      const staff3Page = await staff3Context.newPage();
      await loginAs(staff3Page, "staff3@parsu.edu.ph");
      await expect(staff3Page).toHaveURL(/\/staff\/dashboard/);
      const staleStorageState = await staff3Context.storageState();
      await staff3Context.close();

      // --- 2. Admin deactivates staff3 via the real UI. ---
      await page.goto("/admin/users");
      const row = page.locator("li", { hasText: "staff3@parsu.edu.ph" });
      await row.getByRole("button", { name: "Deactivate" }).click();
      await page.getByRole("button", { name: "Deactivate", exact: true }).last().click();
      await expect(row.getByText("Inactive")).toBeVisible();

      // --- 3. Reuse the PRE-deactivation storageState — the JWT itself is
      // still validly signed and unexpired, but the account is now
      // inactive. A protected page must reject it (redirect to /login,
      // same as an unauthenticated visitor) and a protected API must
      // reject it too. ---
      const staleContext = await browser.newContext({ storageState: staleStorageState });
      const stalePage = await staleContext.newPage();

      await stalePage.goto("/staff/dashboard");
      await expect(stalePage).toHaveURL(/\/login/);

      const apiRes = await stalePage.request.get("/api/notifications");
      expect(apiRes.status()).toBe(401);

      await staleContext.close();
    },
  );
});
