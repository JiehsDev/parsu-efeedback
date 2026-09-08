// tests/e2e/rbac-redirects.spec.ts — BR-084, BR-091..BR-096
//
// Route-level RBAC enforced by src/proxy.ts + src/middleware/rbac.ts: a
// role visiting a route it isn't assigned (per ROLE_ROUTE_PREFIXES) is
// redirected to its own home dashboard (homeRouteForRole). Each role fixture
// here comes from tests/e2e/fixtures.ts (pre-authenticated storageState).
import {
  studentTest,
  staffTest,
  qaTest,
  adminTest,
  vpaaTest,
  vpafTest,
  osasTest,
  expect,
} from "./fixtures";

const HOME: Record<string, string> = {
  student: "/student/dashboard",
  office_staff: "/staff/dashboard",
  qa_office: "/qa/dashboard",
  administrator: "/admin/dashboard",
  vpaa: "/admin/dashboard",
  vpaf: "/admin/dashboard",
  osas: "/admin/dashboard",
};

const OTHER_ROUTES: Record<string, string[]> = {
  student: ["/staff/dashboard", "/qa/dashboard", "/admin/dashboard"],
  office_staff: ["/student/dashboard", "/qa/dashboard", "/admin/dashboard"],
  qa_office: ["/student/dashboard", "/staff/dashboard", "/admin/dashboard"],
};

studentTest.describe("student — BR-092", () => {
  for (const route of OTHER_ROUTES.student!) {
    studentTest(`BR-092/091: student visiting ${route} is redirected to its own dashboard`, async ({
      page,
    }) => {
      await page.goto(route);
      await expect(page).toHaveURL(new RegExp(HOME.student!.replace(/\//g, "\\/")));
    });
  }
});

staffTest.describe("office_staff — BR-093", () => {
  for (const route of OTHER_ROUTES.office_staff!) {
    staffTest(`BR-093/091: staff visiting ${route} is redirected to its own dashboard`, async ({
      page,
    }) => {
      await page.goto(route);
      await expect(page).toHaveURL(new RegExp(HOME.office_staff!.replace(/\//g, "\\/")));
    });
  }
});

qaTest.describe("qa_office — BR-095", () => {
  for (const route of OTHER_ROUTES.qa_office!) {
    qaTest(`BR-095/091: qa visiting ${route} is redirected to its own dashboard`, async ({
      page,
    }) => {
      await page.goto(route);
      await expect(page).toHaveURL(new RegExp(HOME.qa_office!.replace(/\//g, "\\/")));
    });
  }
});

adminTest.describe("administrator — BR-010/096", () => {
  // BR-096/BR-010: "An administrator has unrestricted access to all
  // complaint data, all routes, and all admin functions." Documented
  // expected behavior — asserted as such even though
  // src/middleware/rbac.ts's ROLE_ROUTE_PREFIXES table maps "/student" ->
  // "student" etc. with no special case for "administrator", so this is
  // expected to actually redirect the admin away just like any other
  // mismatched role (a real gap against BR-096, not a test bug — see the
  // final report).
  for (const route of ["/student/dashboard", "/staff/dashboard", "/qa/dashboard"]) {
    adminTest(`BR-096/BR-010: administrator can reach ${route} without being redirected away`, async ({
      page,
    }) => {
      await page.goto(route);
      await expect(page).toHaveURL(new RegExp(route.replace(/\//g, "\\/")));
    });
  }
});

// vpaa/vpaf/osas: scoped sub-admin roles confined to /admin/** — unlike
// administrator, they do NOT bypass every route, so a visit to another
// role's prefix redirects them back to /admin/dashboard just like any
// other non-admin role would be redirected to its own home.
for (const [name, roleTest] of [
  ["vpaa", vpaaTest],
  ["vpaf", vpafTest],
  ["osas", osasTest],
] as const) {
  roleTest.describe(`${name} — scoped sub-admin`, () => {
    for (const route of ["/student/dashboard", "/staff/dashboard", "/qa/dashboard"]) {
      roleTest(`${name} visiting ${route} is redirected to /admin/dashboard`, async ({ page }) => {
        await page.goto(route);
        await expect(page).toHaveURL(/\/admin\/dashboard/);
      });
    }

    roleTest(`${name} can reach /admin/dashboard without being redirected away`, async ({
      page,
    }) => {
      await page.goto("/admin/dashboard");
      await expect(page).toHaveURL(/\/admin\/dashboard/);
    });
  });
}
