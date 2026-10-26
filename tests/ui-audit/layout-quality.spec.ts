import { test, expect } from "@playwright/test";

// Run with npm run test:ui-audit -- layout-quality.spec.ts.
// Uses only the runner's disposable database and seeded accounts.
test("workspace layouts adapt across desktop, tablet and mobile", async ({ browser }) => {
  test.setTimeout(900000);
  expect(process.env.UI_AUDIT_ISOLATED).toBe("1");
  const roles = [
    {
      base: "student",
      email: "student@parsu.edu.ph",
      routes: ["dashboard", "complaints", "complaints/new", "profile"],
    },
    { base: "staff", email: "osas.staff@parsu.edu.ph", routes: ["dashboard", "complaints", "sla"] },
    {
      base: "admin",
      email: "admin@parsu.edu.ph",
      routes: ["dashboard", "complaints", "reports", "settings"],
    },
  ];
  const adminOnly = process.env.UI_LAYOUT_ADMIN_ONLY === "1";
  for (const role of roles.filter((role) => !adminOnly || role.base !== "staff")) {
    const context = await browser.newContext({ baseURL: process.env.PLAYWRIGHT_BASE_URL });
    const page = await context.newPage();
    page.setDefaultTimeout(60000);
    await page.goto("/login");
    await page.getByLabel("Email", { exact: true }).fill(role.email);
    await page.getByLabel("Password", { exact: true }).fill("ParSU_test2026");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.waitForURL(`/${role.base}/dashboard`, { timeout: 120000 });
    if (role.base === "student") {
      await page.goto("/student/complaints/new");
      await page.getByRole("combobox", { name: "Category", exact: true }).click();
      await page
        .getByRole("option", { name: "Student Services & Assistance", exact: true })
        .click();
      await page
        .getByRole("textbox", { name: "Title", exact: true })
        .fill("Unable to access student assistance and enrollment support");
      await page
        .getByRole("textbox", { name: "Description", exact: true })
        .fill(
          "I need help accessing student assistance for enrollment. Please review the available options and explain the next steps for submitting my supporting documents.",
        );
      await page.getByRole("button", { name: "Submit Complaint", exact: true }).click();
      await page.waitForURL(/\/student\/complaints\?submitted=/, { timeout: 120000 });
    }
    const payload = await (await page.request.get("/api/complaints")).json();
    const routes = adminOnly && role.base === "student" ? ["dashboard"] : [...role.routes];
    expect(payload.complaints?.length).toBeGreaterThan(0);
    if (payload.complaints?.length && (!adminOnly || role.base !== "student"))
      routes.push(`complaints/${payload.complaints[0]._id}`);
    for (const route of routes) {
      await page.goto(`/${role.base}/${route}`);
      await expect(page.locator("main h1").first()).toBeVisible();
      if (route === "dashboard" && role.base !== "student")
        await expect(
          page.getByRole("heading", { name: "Open complaints", exact: true }).first(),
        ).toBeVisible();
      if (route === "reports") {
        await expect(page.getByRole("combobox", { name: "Format", exact: true })).toContainText(
          "CSV",
          { timeout: 60000 },
        );
        await expect(page.getByText("No reports generated yet.", { exact: true })).toBeVisible({
          timeout: 60000,
        });
      }
      if (/^complaints\/[a-f0-9]{24}$/.test(route))
        await page.getByText(/Loading attachments/).waitFor({ state: "hidden", timeout: 60000 });
      for (const width of [1920, 1024, 390]) {
        await page.setViewportSize({ width, height: 900 });
        await page.evaluate(() => document.fonts.ready);
        await expect
          .poll(
            () =>
              page.evaluate(() => {
                const main = document.querySelector("main")!;
                return (
                  document.documentElement.scrollWidth <= innerWidth &&
                  main.scrollWidth <= main.clientWidth
                );
              }),
            { message: `${role.base}/${route} overflows at ${width}px` },
          )
          .toBe(true);
        const main = await page.locator("main").boundingBox();
        expect(main!.height).toBeGreaterThan(600);
        if (route === "dashboard") {
          const bounds = await page.locator("main > div").first().boundingBox();
          expect(bounds!.width / main!.width).toBeGreaterThan(0.85);
        }
        await page.screenshot({
          path: `.local-backups/layout-quality/${role.base}-${route.replaceAll("/", "-")}-${width}.png`,
        });
      }
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/${role.base}/dashboard`);
    if (role.base !== "student")
      await expect(
        page.getByRole("heading", { name: "Open complaints", exact: true }).first(),
      ).toBeVisible();
    await page.evaluate(() => (document.documentElement.dataset.mode = "dark"));
    await page.screenshot({ path: `.local-backups/layout-quality/${role.base}-dark.png` });
    await page.getByRole("button", { name: "Account options", exact: true }).click();
    await expect(page.getByRole("link", { name: "Profile settings", exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "Account options", exact: true })).toBeFocused();
    await context.close();
  }
});
