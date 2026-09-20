// tests/e2e/auth.spec.ts — BR-005, BR-012, BR-013, BR-083, BR-085, BR-087
//
// Unauthenticated flows only — imports plain @playwright/test, no
// storageState. Uses staff2@parsu.edu.ph for the lockout test specifically
// because it is NOT one of the five accounts saved as a reusable
// storageState fixture in tests/e2e/auth.setup.ts, so locking it out here
// cannot break any other spec that depends on being able to log in as
// "staff".
import { test, expect } from "@playwright/test";
import { PASSWORD, errorAlert } from "./helpers";

const AUTH_MAX_FAILED_LOGIN_ATTEMPTS = 5; // .env.local — src/features/auth/services/auth.service.ts BR-013

test.describe("Authentication — BR-005/012/013/083/085/087", () => {
  test("BR-013: locks out the account after the configured number of failed attempts", async ({
    page,
  }) => {
    await page.goto("/login");

    for (let attempt = 1; attempt <= AUTH_MAX_FAILED_LOGIN_ATTEMPTS; attempt++) {
      await page.getByLabel("Email").fill("staff2@parsu.edu.ph");
      await page.getByLabel("Password", { exact: true }).fill("definitely-the-wrong-password");
      await page.getByRole("button", { name: "Sign in" }).click();

      const alert = errorAlert(page);
      await expect(alert).toBeVisible({ timeout: 30_000 });

      if (attempt < AUTH_MAX_FAILED_LOGIN_ATTEMPTS) {
        await expect(alert).toHaveText(/invalid email or password/i);
      } else {
        // BR-013: on the attempt that trips the lockout, the account is
        // locked immediately — the response must say so, not just repeat
        // the generic invalid-credentials message.
        await expect(alert).toHaveText(/too many failed attempts|temporarily locked/i);
      }
    }

    // BR-013 (continued): even the *correct* password is now rejected while
    // locked — proves the account is actually locked, not just that the
    // last wrong-password attempt happened to show a locked message.
    await page.getByLabel("Email").fill("staff2@parsu.edu.ph");
    await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(errorAlert(page)).toHaveText(/too many failed attempts|temporarily locked/i);
  });

  test("BR-005: a deactivated account is rejected at login even with the correct password", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("inactive@parsu.edu.ph");
    await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(errorAlert(page)).toHaveText(/deactivated/i);
    // Must not have navigated away from /login.
    await expect(page).toHaveURL(/\/login/);
  });

  test("BR-083/085: an unauthenticated request for a protected page is redirected to /login", async ({
    page,
  }) => {
    await page.goto("/student/dashboard");
    await expect(page).toHaveURL(/\/login(\?|$)/);
  });

  // BR-087: sessions expire after AUTH_SESSION_MAX_AGE_MINUTES (60) of
  // inactivity (src/lib/auth.config.ts, JWT `maxAge`). There is no way to
  // exercise this within a normal test run without either waiting out the
  // real TTL (60+ minutes, making the suite impractically slow/flaky) or
  // reaching into next-auth's JWT signing internals to mint a pre-expired
  // token — both out of scope for a black-box E2E check. Documented here as
  // untestable-by-necessity rather than silently uncovered.
  test.skip(
    "BR-087: session expires after the configured inactivity period (untestable in a normal E2E run — would require waiting out the real 60-minute session TTL, or forging an expired JWT)",
    () => {},
  );
});
