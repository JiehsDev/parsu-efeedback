// tests/e2e/rating.spec.ts — BR-067, BR-068, BR-069
import { adminTest, expect } from "./fixtures";
import { submitComplaint, generatedStudentEmail, loginAs } from "./helpers";

adminTest.describe("Rating", () => {
  adminTest(
    "BR-067/068/069: rating UI only on the student's own resolved complaint, one-time submission, hidden for non-resolved/non-owners",
    async ({ browser }) => {
      const studentContext = await browser.newContext({
        storageState: "tests/e2e/.auth/student.json",
      });
      const studentPage = await studentContext.newPage();
      const { id } = await submitComplaint(
        studentPage,
        "Grade Concern",
        `E2E rating ${Date.now()}`,
        "Automated E2E test complaint for rating verification. Safe to ignore.",
      );

      // BR-067: not resolved yet — no resolution-choice UI.
      await studentPage.goto(`/student/complaints/${id}`);
      await expect(studentPage.getByRole("heading", { name: "Resolution Completed" })).toHaveCount(0);

      // Advance to resolved.
      const staffContext = await browser.newContext({ storageState: "tests/e2e/.auth/staff.json" });
      const staffPage = await staffContext.newPage();
      await staffPage.goto(`/staff/complaints/${id}`);
      await staffPage.getByRole("button", { name: "Pick Up This Complaint" }).click();
      await expect(staffPage.getByRole("combobox")).toBeVisible({ timeout: 30_000 });
      await staffPage.getByRole("combobox").click();
      await staffPage.getByRole("option", { name: "Resolved", exact: true }).click();
      await staffPage.getByRole("button", { name: "Update Status" }).click();
      await expect(staffPage.getByText(/status updated to resolved/i)).toBeVisible();
      await staffContext.close();

      // BR-067: now resolved — the resolution-choice panel appears for the
      // owning student, offering both Rate Resolution and Close Without
      // Rating (rating is optional, not mandatory).
      await studentPage.goto(`/student/complaints/${id}`);
      await expect(studentPage.getByRole("heading", { name: "Resolution Completed" })).toBeVisible();
      await expect(studentPage.getByRole("button", { name: "Close Without Rating" })).toBeVisible();

      await studentPage.getByRole("button", { name: "Rate Resolution" }).click();
      const ratingGroup = studentPage.getByRole("radiogroup", { name: "Rating" });
      await expect(ratingGroup).toBeVisible();

      await studentPage.getByRole("button", { name: "Rate 5 stars" }).click();
      await studentPage.getByPlaceholder("Optional comment").fill("e2e-rating-comment");
      await studentPage.getByRole("button", { name: "Submit Rating" }).click();
      await expect(studentPage.getByText(/thanks for your feedback/i)).toBeVisible();

      // BR-068: after rating, the form is gone and can't be resubmitted —
      // both in the UI (reload) and directly at the API.
      await studentPage.reload();
      await expect(studentPage.getByRole("radiogroup", { name: "Rating" })).toHaveCount(0);
      await expect(studentPage.getByText("Your rating")).toBeVisible();

      const resubmitRes = await studentPage.request.post(`/api/complaints/${id}/rate`, {
        data: { studentRating: 3, studentRatingComment: "should be rejected" },
      });
      expect(resubmitRes.status()).toBe(400);
      await studentContext.close();

      // BR-069: a non-owning student can neither view the page nor rate via the API.
      const otherContext = await browser.newContext();
      const otherPage = await otherContext.newPage();
      await loginAs(otherPage, generatedStudentEmail(0, 1)); // a different CECS student, not the owner
      // The page component's own `notFound()` renders the not-found
      // content (checked here); its HTTP status is 200 rather than a true
      // 404 in this app (src/app/not-found.tsx is a Client Component) — a
      // separate, minor technical quirk, not a data-exposure issue.
      await otherPage.goto(`/student/complaints/${id}`);
      await expect(otherPage.getByText("Page not found")).toBeVisible();

      const otherRateRes = await otherPage.request.post(`/api/complaints/${id}/rate`, {
        data: { studentRating: 1, studentRatingComment: "not mine" },
      });
      expect(otherRateRes.status()).toBe(403);
      await otherContext.close();
    },
  );

  adminTest(
    "resolved complaint can be closed without a rating, leaving rating null",
    async ({ browser }) => {
      const studentContext = await browser.newContext({
        storageState: "tests/e2e/.auth/student.json",
      });
      const studentPage = await studentContext.newPage();
      const { id } = await submitComplaint(
        studentPage,
        "Grade Concern",
        `E2E close-without-rating ${Date.now()}`,
        "Automated E2E test complaint for close-without-rating verification.",
      );

      const staffContext = await browser.newContext({ storageState: "tests/e2e/.auth/staff.json" });
      const staffPage = await staffContext.newPage();
      await staffPage.goto(`/staff/complaints/${id}`);
      await staffPage.getByRole("button", { name: "Pick Up This Complaint" }).click();
      await expect(staffPage.getByRole("combobox")).toBeVisible({ timeout: 30_000 });
      await staffPage.getByRole("combobox").click();
      await staffPage.getByRole("option", { name: "Resolved", exact: true }).click();
      await staffPage.getByRole("button", { name: "Update Status" }).click();
      await expect(staffPage.getByText(/status updated to resolved/i)).toBeVisible();
      // Staff has no manual "closed" option once resolved.
      await staffPage.reload();
      await expect(staffPage.getByRole("combobox")).toHaveCount(0);
      await staffContext.close();

      await studentPage.goto(`/student/complaints/${id}`);
      await studentPage.getByRole("button", { name: "Close Without Rating" }).click();
      await expect(studentPage.getByText("Close this complaint without submitting a rating?")).toBeVisible();
      await studentPage.getByRole("button", { name: "Close Complaint" }).click();
      await expect(studentPage.getByText("Complaint closed.")).toBeVisible();

      await studentPage.reload();
      await expect(studentPage.getByRole("heading", { name: "Complaint Closed" })).toBeVisible();
      await expect(studentPage.getByText("You closed this complaint without submitting a rating.")).toBeVisible();
      await expect(studentPage.getByText("Your rating")).toHaveCount(0);

      const rateAfterCloseRes = await studentPage.request.post(`/api/complaints/${id}/rate`, {
        data: { studentRating: 5 },
      });
      expect(rateAfterCloseRes.status()).toBe(400);
      await studentContext.close();
    },
  );
});
