// tests/e2e/rbac-redirects.spec.ts — BR-084, BR-091..BR-096
//
// Route-level RBAC enforced by src/proxy.ts + src/middleware/rbac.ts: a
// role visiting a route it isn't assigned (per ROLE_ROUTE_PREFIXES) is
// redirected to its own home dashboard (homeRouteForRole). Each role fixture
// here comes from tests/e2e/fixtures.ts (pre-authenticated storageState).
import { studentTest, staffTest, deanTest, qaTest, adminTest, expect } from "./fixtures";

const HOME: Record<string, string> = {
  student: "/student/dashboard",
  office_staff: "/staff/dashboard",
  college_dean: "/dean/dashboard",
  qa_office: "/qa/dashboard",
  administrator: "/admin/dashboard",
};

const OTHER_ROUTES: Record<string, string[]> = {
  student: ["/staff/dashboard", "/dean/dashboard", "/qa/dashboard", "/admin/dashboard"],
  office_staff: ["/student/dashboard", "/dean/dashboard", "/qa/dashboard", "/admin/dashboard"],
  college_dean: ["/student/dashboard", "/staff/dashboard", "/qa/dashboard", "/admin/dashboard"],
  qa_office: ["/student/dashboard", "/staff/dashboard", "/dean/dashboard", "/admin/dashboard"],
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

deanTest.describe("college_dean — BR-094", () => {
  for (const route of OTHER_ROUTES.college_dean!) {
    deanTest(`BR-094/091: dean visiting ${route} is redirected to its own dashboard`, async ({
      page,
    }) => {
      await page.goto(route);
      await expect(page).toHaveURL(new RegExp(HOME.college_dean!.replace(/\//g, "\\/")));
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
  for (const route of ["/student/dashboard", "/staff/dashboard", "/dean/dashboard", "/qa/dashboard"]) {
    adminTest(`BR-096/BR-010: administrator can reach ${route} without being redirected away`, async ({
      page,
    }) => {
      await page.goto(route);
      await expect(page).toHaveURL(new RegExp(route.replace(/\//g, "\\/")));
    });
  }
});
