// tests/e2e/admin-crud.spec.ts — BR-011, BR-016, BR-019, BR-027, BR-034, BR-097
//
// Note on selectors: admin form fields (src/components/admin/FormField.tsx)
// render a `<label>` with no `htmlFor`/`id` linking it to its input/Select
// — getByLabel doesn't work here. tests/e2e/helpers.ts's fieldByLabel/
// selectByLabel walk the DOM the way FormField actually renders (label
// immediately followed by its field) instead.
import { adminTest, staffTest, expect } from "./fixtures";
import { fillFieldByLabel, selectByLabel } from "./helpers";

function uniqueCode(prefix: string) {
  return `${prefix}${Date.now().toString(36).toUpperCase()}`.slice(0, 12);
}

adminTest.describe("Admin CRUD — offices", () => {
  adminTest(
    "BR-016/019: admin creates an office with a unique code; a duplicate code is rejected",
    async ({ page }) => {
      const code = uniqueCode("E2E");
      const name = `E2E Test Office ${Date.now()}`;

      await page.goto("/admin/offices");
      await page.getByRole("button", { name: "Add Office" }).click();
      await fillFieldByLabel(page, "Name", name);
      await fillFieldByLabel(page, "Code", code);
      await page.getByRole("button", { name: "Create Office" }).click();
      await expect(page.getByText(name)).toBeVisible();

      // BR-019: duplicate code rejected with a clear message. Capture the
      // form's own fetch() response directly via waitForResponse — more
      // deterministic than waiting on the resulting DOM state.
      await page.getByRole("button", { name: "Add Office" }).click();
      await fillFieldByLabel(page, "Name", `${name} duplicate`);
      await fillFieldByLabel(page, "Code", code);
      const [dupUiResponse] = await Promise.all([
        page.waitForResponse(
          (res) => res.url().endsWith("/api/admin/offices") && res.request().method() === "POST",
        ),
        page.getByRole("button", { name: "Create Office" }).click(),
      ]);
      expect(dupUiResponse.status()).toBe(409);
      const dupUiBody = await dupUiResponse.json();
      expect(String(dupUiBody.error)).toMatch(/already exists/i);
      // The handler sets `error` state on a non-ok response and keeps the
      // modal open (src/app/admin/offices/page.tsx's handleCreate). Note
      // this error box (unlike the login page's) has no `role="alert"` —
      // matched by visible text instead.
      await expect(page.getByText("Office code already exists")).toBeVisible();
    },
  );
});

// NOTE: src/proxy.ts's matcher applies to every path except
// api/auth|api/cron|api/colleges|_next/*|favicon.ico — that includes
// /api/admin/*. Its RBAC step treats /api/admin/* like a *page* route
// (requiredRoleForPath -> "administrator") and, for a wrong-role
// authenticated user, issues a 302 redirect to that role's own dashboard
// — never a 403. That contradicts BR-085 ("...a 403 JSON response for API
// routes"), which the route handlers' own requireAdmin() guard would
// satisfy correctly *if it were ever reached* — the redirect happens one
// layer before that. `maxRedirects: 0` below surfaces the redirect status
// directly instead of Playwright silently following it to a 200'd
// dashboard page, so a failure here reads as "302, not 403" rather than a
// confusing "200".
staffTest.describe("Admin CRUD — non-admin API 403s", () => {
  staffTest("BR-097/085: a non-admin POSTing /api/admin/offices directly is 403'd at the handler", async ({
    request,
  }) => {
    const res = await request.post("/api/admin/offices", {
      data: { name: "Should not be created", code: uniqueCode("NOPE"), type: "university_office" },
      maxRedirects: 0,
    });
    expect(res.status()).toBe(403);
  });

  staffTest("BR-034/097/085: a non-admin POSTing /api/admin/routing-rules directly is 403'd", async ({
    request,
  }) => {
    const res = await request.post("/api/admin/routing-rules", {
      data: { categoryRef: "000000000000000000000000", targetOfficeRef: "000000000000000000000000" },
      maxRedirects: 0,
    });
    expect(res.status()).toBe(403);
  });

  staffTest("BR-027/097/085: a non-admin POSTing /api/admin/sla-rules directly is 403'd", async ({
    request,
  }) => {
    const res = await request.post("/api/admin/sla-rules", {
      data: {
        categoryRef: "000000000000000000000000",
        priority: "medium",
        responseHours: 8,
        resolutionHours: 48,
      },
      maxRedirects: 0,
    });
    expect(res.status()).toBe(403);
  });
});

adminTest.describe("Admin CRUD — category + routing rule + SLA rule wizard", () => {
  adminTest(
    "BR-027/034: admin creates a category with a routing rule and SLA rule via the setup wizard",
    async ({ page }) => {
      const name = `E2E Category ${Date.now()}`;

      await page.goto("/admin/categories/new");
      await fillFieldByLabel(page, "Name", name);
      await page.getByRole("button", { name: "Next: Routing Rule" }).click();

      await selectByLabel(page, "Target office", "Quality Assurance Office");
      await page.getByRole("button", { name: "Next: SLA Rule" }).click();

      await page.getByRole("button", { name: "Review" }).click();
      await expect(page.getByText("Category, routing rule, and SLA rule are all set.")).toBeVisible();

      await page.getByRole("button", { name: "Activate Category" }).click();
      await page.waitForURL(/\/admin\/categories\/[a-f0-9]{24}/);
      await expect(page.getByText(name)).toBeVisible();
      await expect(page.getByText(/routes to quality assurance office/i)).toBeVisible();
    },
  );
});

adminTest.describe("Admin CRUD — users", () => {
  adminTest(
    "BR-011: admin creates and deactivates a staff user",
    async ({ page }) => {
      const email = `e2e-staff-${Date.now()}@parsu.edu.ph`;

      await page.goto("/admin/users");
      await page.getByRole("button", { name: "Add User" }).click();
      await fillFieldByLabel(page, "First name", "E2E");
      await fillFieldByLabel(page, "Last name", "TestStaff");
      await fillFieldByLabel(page, "Email", email);
      await fillFieldByLabel(page, "Employee/Student ID", `E2E-${Date.now()}`);
      await fillFieldByLabel(page, "Password", "ParSU_test2026");
      // Role defaults to "office_staff", which needs an Office selection.
      await selectByLabel(page, "Office", "Quality Assurance Office");
      await page.getByRole("button", { name: "Create User" }).click();
      await expect(page.getByText(email)).toBeVisible();

      const row = page.locator("li", { hasText: email });
      await row.getByRole("button", { name: "Deactivate" }).click();
      // ConfirmProvider (src/components/shared/ConfirmDialog.tsx) renders
      // its dialog as `{children}{state.open && <dialog/>}` — the dialog's
      // own "Deactivate" confirm button is always last in DOM order,
      // after the row's own button of the same name.
      await page.getByRole("button", { name: "Deactivate", exact: true }).last().click();
      await expect(row.getByText("Inactive")).toBeVisible();
    },
  );

  staffTest("BR-011/097/085: office_staff POSTing /api/admin/users directly is 403'd", async ({
    request,
  }) => {
    const res = await request.post("/api/admin/users", {
      data: {
        employeeOrStudentId: `E2E-STAFF-${Date.now()}`,
        firstName: "Should",
        lastName: "NotBeCreated",
        email: `e2e-staff-attempt-${Date.now()}@parsu.edu.ph`,
        password: "ParSU_test2026",
        role: "office_staff",
        officeRef: "000000000000000000000000",
      },
      maxRedirects: 0,
    });
    expect(res.status()).toBe(403);
  });
});
