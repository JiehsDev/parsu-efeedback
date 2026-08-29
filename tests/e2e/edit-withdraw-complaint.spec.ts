// tests/e2e/edit-withdraw-complaint.spec.ts — BR-101
// Student may edit (title/description only — NOT priority, see BR-022/037)
// or withdraw their own complaint while it's still "submitted" — before any
// staff has picked it up. Once picked up, both are gone, in the UI and at
// the API.
import { adminTest, expect } from "./fixtures";
import { submitComplaint, generatedStudentEmail, loginAs, fillFieldByLabel } from "./helpers";

adminTest.describe("Edit / withdraw a complaint before pickup", () => {
  adminTest(
    "BR-101: student can edit a submitted complaint, but not after it's picked up",
    async ({ browser }) => {
      const studentContext = await browser.newContext({
        storageState: "tests/e2e/.auth/student.json",
      });
      const studentPage = await studentContext.newPage();
      const { id } = await submitComplaint(
        studentPage,
        "Grade Concern",
        `E2E edit ${Date.now()}`,
        "Automated E2E test complaint for edit/withdraw verification. Safe to ignore.",
      );

      await studentPage.goto(`/student/complaints/${id}`);
      await expect(studentPage.getByRole("button", { name: "Edit" })).toBeVisible();
      await studentPage.getByRole("button", { name: "Edit" }).click();

      const newTitle = `E2E edit ${Date.now()} — updated`;
      await fillFieldByLabel(studentPage, "Title", newTitle);
      await studentPage.getByRole("button", { name: "Save Changes" }).click();
      await expect(studentPage.getByText("Complaint updated")).toBeVisible();
      await expect(studentPage.getByRole("heading", { name: newTitle })).toBeVisible();

      // BR-022/037: priority isn't student-editable at all — even a direct
      // API call that includes it has the field silently dropped, not
      // applied. "Grade Concern" seeds as defaultPriority: "medium".
      const priorityAttemptRes = await studentPage.request.patch(`/api/complaints/${id}`, {
        data: { title: newTitle, description: "Trying to sneak a priority change in.", priority: "critical" },
      });
      expect(priorityAttemptRes.ok()).toBeTruthy();
      const { complaint: afterPriorityAttempt } = await priorityAttemptRes.json();
      expect(afterPriorityAttempt.priority).toBe("medium");

      // Staff picks it up — edit controls must disappear for the student,
      // and the route itself must reject an edit attempt even if the
      // client somehow still had the form open.
      const staffContext = await browser.newContext({ storageState: "tests/e2e/.auth/staff.json" });
      const staffPage = await staffContext.newPage();
      await staffPage.goto(`/staff/complaints/${id}`);
      // Wait for the actual assign response, not just the click — the
      // button's router.refresh() afterward is async and its completion
      // isn't a reliable enough signal on its own (same class of race as
      // complaint-status-lifecycle.spec.ts's status-update waits).
      await Promise.all([
        staffPage.waitForResponse(
          (res) => res.url().includes(`/api/complaints/${id}/assign`) && res.request().method() === "POST",
        ),
        staffPage.getByRole("button", { name: "Pick Up This Complaint" }).click(),
      ]);
      await expect(staffPage.getByRole("combobox")).toBeVisible();
      await staffContext.close();

      await studentPage.goto(`/student/complaints/${id}`);
      await expect(studentPage.getByRole("button", { name: "Edit" })).toHaveCount(0);
      await expect(studentPage.getByRole("button", { name: "Withdraw" })).toHaveCount(0);

      const lateEditRes = await studentPage.request.patch(`/api/complaints/${id}`, {
        data: { title: "Should be rejected — already assigned" },
      });
      expect(lateEditRes.status()).toBe(400);
      await studentContext.close();
    },
  );

  adminTest(
    "BR-101: student can withdraw a submitted complaint; it becomes inert to staff too",
    async ({ browser }) => {
      const studentContext = await browser.newContext({
        storageState: "tests/e2e/.auth/student.json",
      });
      const studentPage = await studentContext.newPage();
      const { id } = await submitComplaint(
        studentPage,
        "Grade Concern",
        `E2E withdraw ${Date.now()}`,
        "Automated E2E test complaint for edit/withdraw verification. Safe to ignore.",
      );

      await studentPage.goto(`/student/complaints/${id}`);
      await studentPage.getByRole("button", { name: "Withdraw" }).click();
      await studentPage.getByRole("button", { name: "Withdraw", exact: true }).last().click();
      await expect(studentPage.getByText("Complaint withdrawn")).toBeVisible();
      // "Withdrawn" itself appears in more than one place at once (the
      // status badge — twice, once per responsive breakpoint variant —
      // and this timeline entry), so assert on the one unambiguous,
      // never-hidden instance rather than a `.first()` match that could
      // resolve to whichever badge variant the current viewport hides.
      await expect(studentPage.getByText("Withdrawn by student")).toBeVisible();
      await expect(studentPage.getByRole("button", { name: "Edit" })).toHaveCount(0);
      await expect(studentPage.getByRole("button", { name: "Withdraw" })).toHaveCount(0);

      // Withdrawn is terminal — a second withdraw attempt via the API 400s.
      const secondWithdrawRes = await studentPage.request.patch(`/api/complaints/${id}`, {
        data: { status: "withdrawn" },
      });
      expect(secondWithdrawRes.status()).toBe(400);
      await studentContext.close();

      // Staff sees it as withdrawn (not pickable), and can't revive it via
      // the generic status route either — a withdrawn complaint stays inert
      // rather than quietly re-entering the office's active queue.
      const staffContext = await browser.newContext({ storageState: "tests/e2e/.auth/staff.json" });
      const staffPage = await staffContext.newPage();
      await staffPage.goto(`/staff/complaints/${id}`);
      await expect(staffPage.getByText("Withdrawn by student")).toBeVisible();
      await expect(staffPage.getByRole("button", { name: "Pick Up This Complaint" })).toHaveCount(0);

      const staffReviveRes = await staffPage.request.patch(`/api/complaints/${id}`, {
        data: { status: "assigned" },
      });
      expect(staffReviveRes.status()).toBe(400);
      await staffContext.close();
    },
  );

  adminTest(
    "BR-101: a non-owning student cannot edit or withdraw someone else's complaint",
    async ({ browser }) => {
      const studentContext = await browser.newContext({
        storageState: "tests/e2e/.auth/student.json",
      });
      const studentPage = await studentContext.newPage();
      const { id } = await submitComplaint(
        studentPage,
        "Grade Concern",
        `E2E ownership ${Date.now()}`,
        "Automated E2E test complaint for edit/withdraw verification. Safe to ignore.",
      );
      await studentContext.close();

      const otherContext = await browser.newContext();
      const otherPage = await otherContext.newPage();
      await loginAs(otherPage, generatedStudentEmail(0, 1)); // a different student, not the owner

      const editRes = await otherPage.request.patch(`/api/complaints/${id}`, {
        data: { title: "Not mine to edit" },
      });
      expect(editRes.status()).toBe(403);

      const withdrawRes = await otherPage.request.patch(`/api/complaints/${id}`, {
        data: { status: "withdrawn" },
      });
      expect(withdrawRes.status()).toBe(403);
      await otherContext.close();
    },
  );
});
