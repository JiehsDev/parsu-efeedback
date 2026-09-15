import {
  adminTest,
  expect,
  osasTest,
  staffTest,
  studentTest,
  vpaaTest,
  vpafTest,
} from "./fixtures";

studentTest.describe("student RBAC redirects", () => {
  for (const route of ["/staff/dashboard", "/admin/dashboard"]) {
    studentTest(`student visiting ${route} is redirected to student dashboard`, async ({ page }) => {
      await page.goto(route);
      await expect(page).toHaveURL(/\/student\/dashboard/);
    });
  }
});

staffTest.describe("office_staff RBAC redirects", () => {
  for (const route of ["/student/dashboard", "/admin/dashboard"]) {
    staffTest(`staff visiting ${route} is redirected to staff dashboard`, async ({ page }) => {
      await page.goto(route);
      await expect(page).toHaveURL(/\/staff\/dashboard/);
    });
  }
});

adminTest.describe("administrator unrestricted route access", () => {
  for (const route of ["/student/dashboard", "/staff/dashboard"]) {
    adminTest(`administrator can reach ${route}`, async ({ page }) => {
      await page.goto(route);
      await expect(page).toHaveURL(new RegExp(route.replace(/\//g, "\\/")));
    });
  }

  adminTest("administrator can see the notification broadcast composer", async ({ page }) => {
    await page.goto("/admin/notifications");
    await expect(page.getByText("Send Announcement").first()).toBeVisible();
  });
});

for (const [name, roleTest] of [
  ["vpaa", vpaaTest],
  ["vpaf", vpafTest],
  ["osas", osasTest],
] as const) {
  roleTest.describe(`${name} scoped sub-admin redirects`, () => {
    for (const route of ["/student/dashboard", "/staff/dashboard"]) {
      roleTest(`${name} visiting ${route} redirects to admin dashboard`, async ({ page }) => {
        await page.goto(route);
        await expect(page).toHaveURL(/\/admin\/dashboard/);
      });
    }

    roleTest(`${name} can reach /admin/dashboard`, async ({ page }) => {
      await page.goto("/admin/dashboard");
      await expect(page).toHaveURL(/\/admin\/dashboard/);
    });

    roleTest(`${name} cannot see the notification broadcast composer`, async ({ page }) => {
      await page.goto("/admin/notifications");
      await expect(page.getByText("Send Announcement")).toHaveCount(0);
    });
  });
}
