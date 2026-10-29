import { test, expect, type Page } from "@playwright/test";

test("category classification stays separate from OSAS intake and remains manageable", async ({
  browser,
}) => {
  test.setTimeout(600000);
  expect(process.env.UI_AUDIT_ISOLATED).toBe("1");
  async function login(email: string) {
    const context = await browser.newContext({ baseURL: process.env.PLAYWRIGHT_BASE_URL });
    const page = await context.newPage();
    page.setDefaultTimeout(60000);
    await page.goto("/login");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill("ParSU_test2026");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.waitForURL(/\/(student|admin)\/dashboard/, { timeout: 120000 });
    return { page, context };
  }
  const student = await login("student@parsu.edu.ph");
  const admin = await login("admin@parsu.edu.ph");
  // This task changes category content, not the persistent navigation shell.
  async function categoryContentFits(page: Page) {
    await expect
      .poll(() =>
        page.evaluate(() => {
          const main = document.querySelector("main")!;
          return main.scrollWidth <= main.clientWidth;
        }),
      )
      .toBe(true);
  }
  try {
    const categories = (await (await student.page.request.get("/api/categories")).json())
      .categories;
    expect(categories.map((category: any) => category.name)).toEqual(
      expect.arrayContaining([
        "Curriculum & Class Scheduling",
        "Academic Advising & Consultation",
        "Library Services & Resources",
        "Student Payment & Cashier Concerns",
      ]),
    );
    for (const category of categories) {
      expect(category).not.toHaveProperty("group");
      expect(category).not.toHaveProperty("defaultOfficeRef");
    }
    await student.page.goto("/student/complaints/new");
    const picker = student.page.getByRole("combobox", { name: "Category", exact: true });
    for (const width of [1440, 768, 390]) {
      await student.page.setViewportSize({ width, height: 900 });
      await picker.click();
      for (const label of ["OSAS", "VPAA", "VPAF"])
        await expect(student.page.getByRole("group", { name: label, exact: true })).toHaveCount(0);
      await expect(student.page.getByRole("option")).toHaveCount(categories.length);
      await student.page
        .getByRole("option", { name: "Student Payment & Cashier Concerns", exact: true })
        .click();
      await expect(picker).toContainText("Student Payment & Cashier Concerns");
      await expect(
        student.page.getByText("Tuition payment posting delays, fee assessment discrepancies", {
          exact: true,
        }),
      ).toBeVisible();
      await categoryContentFits(student.page);
      await student.page.screenshot({
        path: `.local-backups/category-review/student-${width}.png`,
      });
    }
    await student.page
      .getByRole("textbox", { name: "Title", exact: true })
      .fill("Category UI verification concern");
    await student.page
      .getByRole("textbox", { name: "Description", exact: true })
      .fill("Please review this payment concern and provide an appropriate response.");
    await student.page.getByRole("button", { name: "Submit Complaint", exact: true }).click();
    await student.page.waitForURL(/\/student\/complaints\?submitted=/, { timeout: 120000 });
    const submitted = (
      await (await student.page.request.get("/api/complaints")).json()
    ).complaints.find((c: any) => c.title === "Category UI verification concern");
    expect(submitted).toBeTruthy();
    const configuredOffice = (
      await (await admin.page.request.get("/api/admin/offices")).json()
    ).offices.find((office: any) => office.code === "OSAS");
    const detail = (
      await (await student.page.request.get(`/api/complaints/${submitted._id}`)).json()
    ).complaint;
    expect(String(detail.assignedOfficeRef._id ?? detail.assignedOfficeRef)).toBe(
      String(configuredOffice._id),
    );

    await admin.page.goto("/admin/categories");
    for (const label of ["OSAS", "VPAA", "VPAF"])
      await expect(
        admin.page.getByRole("heading", { name: new RegExp(`^${label} \\(`) }),
      ).toBeVisible();
    await admin.page.getByRole("textbox", { name: "Search categories", exact: true }).fill("VPAA");
    await expect(
      admin.page.locator('a[href^="/admin/categories/"]', {
        hasText: "Curriculum & Class Scheduling",
      }),
    ).toBeVisible();
    await expect(
      admin.page.locator('a[href^="/admin/categories/"]', {
        hasText: "Medical and Dental Services",
      }),
    ).toHaveCount(0);
    await admin.page.getByRole("textbox", { name: "Search categories", exact: true }).fill("");
    for (const width of [1440, 768, 390]) {
      await admin.page.setViewportSize({ width, height: 900 });
      await categoryContentFits(admin.page);
      await admin.page.screenshot({ path: `.local-backups/category-review/admin-${width}.png` });
    }
    await admin.page.goto("/admin/categories/new");
    await admin.page
      .getByRole("textbox", { name: "Name", exact: true })
      .fill("QA configurable academic category");
    await admin.page
      .getByRole("textbox", { name: "Description", exact: true })
      .fill("A configurable category used by the isolated UI test.");
    await admin.page
      .getByRole("combobox", { name: "Category group", exact: true })
      .selectOption("vpaa");
    await admin.page.getByRole("button", { name: "Save category", exact: true }).click();
    await admin.page.waitForURL("/admin/categories", { timeout: 120000 });
    const created = (
      await (await admin.page.request.get("/api/admin/categories")).json()
    ).categories.find((c: any) => c.name === "QA configurable academic category");
    expect(created).toMatchObject({
      group: "vpaa",
      isActive: true,
      defaultOfficeRef: configuredOffice._id,
    });
    await admin.page.goto(`/admin/categories/${created._id}`);
    await admin.page.getByRole("button", { name: "Edit Category", exact: true }).click();
    await admin.page
      .getByRole("combobox", { name: "Category group", exact: true })
      .selectOption("vpaf");
    await admin.page.getByRole("button", { name: "Save Changes", exact: true }).click();
    await expect(admin.page.getByRole("dialog")).toHaveCount(0);
    await expect
      .poll(
        async () =>
          (await (await admin.page.request.get(`/api/admin/categories/${created._id}`)).json())
            .category.group,
      )
      .toBe("vpaf");
    await categoryContentFits(admin.page);
  } finally {
    await student.context.close();
    await admin.context.close();
  }
});
