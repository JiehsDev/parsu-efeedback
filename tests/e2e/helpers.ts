// tests/e2e/helpers.ts
//
// Small shared helpers used across the Phase 2 specs. Kept separate from
// fixtures.ts (which only exports the role-scoped `test`/`expect` wrappers)
// so specs can mix "a pre-authenticated role fixture" with "a one-off login
// as some other seeded account" (e.g. a student from a different college,
// to prove a dean's cross-college scope check) in the same file.
import type { Page } from "@playwright/test";

export const PASSWORD = "ParSU_test2026";

/**
 * Every `role="alert"` error box in this app's own components has no `id`
 * — but Next.js's App Router also injects its own `<div role="alert"
 * aria-live="assertive" id="__next-route-announcer__">` on every page for
 * screen-reader route-change announcements, which `page.getByRole("alert")`
 * also matches (usually empty, but still a second match that breaks
 * Playwright's strict mode). This excludes it so `getByRole("alert")`-style
 * assertions resolve to the app's real error message.
 */
export function errorAlert(page: Page) {
  return page.locator('[role="alert"]:not(#__next-route-announcer__)').first();
}

/**
 * Logs `page` into the real /login UI as `email` (every seeded account
 * shares PASSWORD, see src/app/api/dev/seed/route.ts) and waits for the
 * post-login redirect. Use this instead of a storageState fixture when a
 * spec needs an account not covered by tests/e2e/fixtures.ts's seven
 * pre-authenticated roles — e.g. a specific generated student, to control
 * which college/office a complaint routes/scopes to.
 */
export async function loginAs(page: Page, email: string, password = PASSWORD) {
  // loginAs is used to switch identities inside a role-scoped test. Clear
  // inherited fixture cookies so the public layout cannot redirect us to the
  // previous role's dashboard before the requested credentials are entered.
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/(dashboard|student|staff|qa|admin)/, { timeout: 60_000 });
}

/**
 * Seed-generated students (src/app/api/dev/seed/route.ts, `generatedStudents`)
 * are created in a fixed order: STUDENTS_PER_COLLEGE (7) per college, in the
 * `colleges` array order [CECS (primary, student@'s college), CED, CBM, COS,
 * CAH], starting at studentSeq 20001. This resolves the first generated
 * student's email for a given 0-based college index, so specs needing "a
 * student definitely NOT in CECS" (index 0) can reach one deterministically
 * without querying the DB directly.
 */
export function generatedStudentEmail(collegeIndex: number, offsetInCollege = 0): string {
  const seqStart = 20001 + collegeIndex * 7 + offsetInCollege;
  return `student${seqStart}@parsu.edu.ph`;
}

/**
 * Most admin form fields (src/components/admin/FormField.tsx) render a
 * plain `<label>{label}</label>` with NO `htmlFor`/`id` association to the
 * input/Select that follows it as a sibling — so Playwright's `getByLabel`
 * cannot find them (there is no admin-side data-testid either). This
 * targets the field the same way a sighted user would find it: the element
 * immediately following a label with this exact text, which is exactly
 * FormField's DOM shape (`<div><label/>{children}{hint?}</div>`).
 */
export function fieldByLabel(page: Page, labelText: string) {
  return page.locator(
    `xpath=//label[normalize-space(text())="${labelText}"]/following-sibling::*[1]`,
  );
}

export async function fillFieldByLabel(page: Page, labelText: string, value: string) {
  await fieldByLabel(page, labelText).fill(value);
}

/** Opens a FormField-driven Radix Select by its label and picks `optionText`. */
export async function selectByLabel(page: Page, labelText: string, optionText: string) {
  await fieldByLabel(page, labelText).click();
  await page.getByRole("option", { name: optionText, exact: true }).click();
}

/** Creates a complaint as the currently-logged-in student (via `page`'s own
 * session cookies) by picking the category option matching `categoryName`
 * from the real submission form — this keeps routing deterministic (each
 * seeded category has exactly one active RoutingRule/SLARule target, see
 * seed route) without hardcoding office ids. Returns the resulting
 * complaint id and ticket number.
 */
export async function submitComplaint(
  page: Page,
  categoryName: string,
  title: string,
  description: string,
): Promise<{ id: string; ticketNumber: string }> {
  await page.goto("/student/complaints/new");
  await page.getByLabel("Category").click();
  await page.getByRole("option", { name: categoryName, exact: true }).click();
  await page.getByLabel("Title").fill(title);
  await page.getByLabel("Description").fill(description);
  await page.getByRole("button", { name: "Submit Complaint" }).click();
  await page.waitForURL(/\/student\/complaints\?submitted=/, { timeout: 60_000 });
  const url = new URL(page.url());
  const ticketNumber = url.searchParams.get("submitted")!;

  // Open it to recover the Mongo id from the URL (the list/redirect only
  // carries the ticket number).
  await page.getByRole("link", { name: new RegExp(ticketNumber) }).first().click();
  await page.waitForURL(/\/student\/complaints\/[a-f0-9]{24}/);
  const id = page.url().split("/").pop()!.split("?")[0]!;
  return { id, ticketNumber };
}
