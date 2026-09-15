// tests/e2e/complaint-submission.spec.ts
// BR-021, BR-022, BR-024, BR-026, BR-035, BR-036, BR-037, BR-038, BR-039
//
// Note on selectors: no complaint detail page (student, staff, dean, qa, or
// admin) renders the category *name* anywhere — only priority and the
// auto-routed office are shown (see src/app/*/complaints/[id]/page.tsx).
// So BR-021 ("belongs to exactly one category") is verified via the
// GET /api/complaints/[id] JSON (`categoryRef`) rather than a UI string,
// while BR-026 (auto-routing) is verified through the admin view's visible
// "Office" field, which *is* rendered.
import { studentTest, adminTest, expect } from "./fixtures";
import { submitComplaint, errorAlert } from "./helpers";

const CATEGORY_NAME = "Grade Concern"; // seed route: routes to "Office of the University Registrar"
const EXPECTED_OFFICE_NAME = "Office of the University Registrar";

studentTest.describe("Complaint submission — student", () => {
  studentTest(
    "BR-037: submitting with missing required fields shows a validation error and does not navigate away",
    async ({ page }) => {
      await page.goto("/student/complaints/new");
      // Leave category/title/description all empty and submit directly.
      await page.getByRole("button", { name: "Submit Complaint" }).click();

      await expect(errorAlert(page)).toBeVisible();
      await expect(page).toHaveURL(/\/student\/complaints\/new/);
    },
  );

  studentTest(
    "BR-021/022/026/035/036/038/039: a valid submission gets a well-formed ticket, is auto-routed, and is retrievable by its owner",
    async ({ page, request }) => {
      const title = `E2E grade concern ${Date.now()}`;
      const { id: complaintId, ticketNumber } = await submitComplaint(
        page,
        CATEGORY_NAME,
        title,
        "Automated E2E test complaint — safe to ignore. Repeated to satisfy the min length.",
      );

      // BR-036: PREFIX-YYYY-NNNNNN, e.g. PARSU-2026-000001.
      expect(ticketNumber).toMatch(/^[A-Z]+-\d{4}-\d{6}$/);

      // BR-039: retrievable by its owner — already true since we just
      // navigated to it via the student's own list; confirm the title too.
      await expect(page.getByText(title)).toBeVisible();

      // BR-021/038: exactly one category, exactly one submitting student —
      // checked via the API since neither is rendered on any detail page.
      const apiRes = await request.get(`/api/complaints/${complaintId}`);
      expect(apiRes.ok()).toBeTruthy();
      const { complaint } = await apiRes.json();
      expect(complaint.categoryRef).toBeTruthy();
      expect(complaint.studentRef).toBeTruthy();
      expect(complaint.ticketNumber).toBe(ticketNumber);
    },
  );
});

adminTest.describe("Complaint submission — auto-routing visible to admin", () => {
  adminTest(
    "BR-026: a Grade Concern complaint is auto-routed to the Registrar's office, visible on the admin complaint view",
    async ({ page, browser }) => {
      // Independent student context (not the adminTest fixture's own
      // session) so this test can submit as a student while `page` stays
      // signed in as admin.
      const studentContext = await browser.newContext({
        storageState: "tests/e2e/.auth/student.json",
      });
      const studentPage = await studentContext.newPage();
      const { id: complaintId } = await submitComplaint(
        studentPage,
        CATEGORY_NAME,
        `E2E routing check ${Date.now()}`,
        "Automated E2E test complaint for routing verification. Safe to ignore.",
      );
      await studentContext.close();

      await page.goto(`/admin/complaints/${complaintId}`);
      await expect(page.getByRole("definition").filter({ hasText: EXPECTED_OFFICE_NAME })).toBeVisible();
    },
  );
});
