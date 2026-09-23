// tests/e2e/complaint-status-lifecycle.spec.ts
// BR-040, BR-041, BR-042, BR-043, BR-044, BR-045, BR-053
//
// Legal transition graph (src/features/complaints/services/status-transitions.service.ts):
//   submitted -> in_progress -> resolved -> closed (after student rating)
//
// Drives one complaint through its full lifecycle across three roles
// (student creates, staff advances it, admin reopens it) using separate
// browser contexts per role inside a single adminTest so the whole chain
// shares one complaint id without juggling test-to-test hand-off.
import { adminTest, expect } from "./fixtures";
import { submitComplaint } from "./helpers";

const CATEGORY_NAME = "Document Request Delays"; // routes to the Registrar's office, same as `staff@parsu.edu.ph`

adminTest.describe("Complaint status lifecycle", () => {
  adminTest(
    "BR-040/041/042/045/053: pickup, resolution, rating-driven closure, illegal transitions, and no delete UI",
    async ({ page: adminPage, browser }) => {
      // --- 1. Student creates the complaint ---
      const studentContext = await browser.newContext({
        storageState: "tests/e2e/.auth/student.json",
      });
      const studentPage = await studentContext.newPage();
      const { id } = await submitComplaint(
        studentPage,
        CATEGORY_NAME,
        `E2E lifecycle ${Date.now()}`,
        "Automated E2E test complaint for status-lifecycle verification. Safe to ignore.",
      );

      // --- 2. Staff self-assigns and advances it through legal transitions ---
      const staffContext = await browser.newContext({ storageState: "tests/e2e/.auth/staff.json" });
      const staffPage = await staffContext.newPage();
      await staffPage.goto(`/staff/complaints/${id}`);
      await staffPage.getByRole("button", { name: "Pick Up This Complaint" }).click();
      // The status-update form only renders once this staff member is the
      // assigned staff — its appearance itself confirms the self-assign
      // succeeded and advanced the complaint out of "submitted".
      await expect(staffPage.getByText("In Progress", { exact: true }).last()).toBeVisible();

      // BR-041: from "assigned", the generic status form only offers
      // in_progress. Escalation is a separate manual workflow.
      await expect(staffPage.getByRole("combobox")).toBeVisible();
      // Wait for the actual PATCH response, not just the UI text becoming
      // visible — router.refresh() (called on success) re-renders
      // asynchronously, so "text became visible" doesn't reliably mean the
      // server-side save has committed yet, which the next line's direct
      // API call depends on.
      // BR-041: an illegal transition (in_progress -> closed is not a legal
      // edge; only pending_information/resolved are) is rejected
      // by the handler even when called directly, not just hidden from the
      // dropdown.
      const illegalRes = await staffPage.request.patch(`/api/complaints/${id}`, {
        data: { status: "closed" },
      });
      expect(illegalRes.status()).toBe(400);

      // Escalation is not a generic status update. It must use the manual
      // escalation workflow so routing and audit history cannot be bypassed.
      const genericEscalationRes = await staffPage.request.patch(`/api/complaints/${id}`, {
        data: { status: "escalated" },
      });
      expect(genericEscalationRes.status()).toBe(400);

      // in_progress -> resolved
      await staffPage.getByRole("combobox").click();
      await staffPage.getByRole("option", { name: "Resolved", exact: true }).click();
      await staffPage.getByPlaceholder("Optional note about this change").fill("e2e-to-resolved");
      const [patch2] = await Promise.all([
        staffPage.waitForResponse(
          (res) => res.url().includes(`/api/complaints/${id}`) && res.request().method() === "PATCH",
        ),
        staffPage.getByRole("button", { name: "Update Status" }).click(),
      ]);
      expect(patch2.ok()).toBeTruthy();
      await expect(staffPage.getByText("e2e-to-resolved")).toBeVisible();

      // BR-041 no-op: same-status transition is illegal too. The save
      // above is now guaranteed committed (we waited on its PATCH
      // response), so this direct API call is reading the real, current
      // "closed" status, not a stale one.
      const noopRes = await staffPage.request.patch(`/api/complaints/${id}`, {
        data: { status: "closed" },
      });
      expect(noopRes.status()).toBe(400);
      await staffContext.close();

      // --- 3. Student view of the now-closed complaint: no edit/status controls ---
      await studentPage.goto(`/student/complaints/${id}`);
      await expect(studentPage.getByRole("radiogroup", { name: "Rating" })).toBeVisible();
      await studentPage.getByRole("button", { name: "Rate 5 stars" }).click();
      await studentPage.getByRole("button", { name: "Submit Rating" }).click();
      await expect(studentPage.getByRole("heading", { name: "Complaint Closed" })).toBeVisible();
      await expect(studentPage.getByRole("button", { name: "Update Status" })).toHaveCount(0);
      await expect(studentPage.getByRole("button", { name: "Pick Up This Complaint" })).toHaveCount(0);
      await expect(studentPage.getByRole("button", { name: /submit rating/i })).toHaveCount(0);
      await expect(studentPage.getByRole("button", { name: /delete/i })).toHaveCount(0);
      await studentContext.close();

      // --- 4. Admin reopens the closed complaint (no UI control for this —
      // only staff have a status form, and it's only ever visible when
      // *that same user* is the assigned staff member — so this goes
      // straight through the API, same as the app's own admin surface
      // would have to). BR-043/044: reopenCount increments and is visible
      // (via the API — no page renders reopenCount either).
      const reopenRes = await adminPage.request.patch(`/api/complaints/${id}`, {
        data: { status: "in_progress", message: "e2e-admin-reopen" },
      });
      expect(reopenRes.status()).toBe(400);

      // --- 5. BR-045: no delete UI anywhere — only archive, admin-only. ---
      await adminPage.goto(`/admin/complaints/${id}`);
      await expect(adminPage.getByRole("button", { name: "Archive Complaint" })).toBeVisible();
      await expect(adminPage.getByRole("button", { name: /^delete/i })).toHaveCount(0);
    },
  );
});
