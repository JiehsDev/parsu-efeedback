// tests/e2e/notes-and-notifications.spec.ts — BR-063, BR-064, BR-071, BR-073
import { adminTest, expect } from "./fixtures";
import { submitComplaint } from "./helpers";

adminTest.describe("Notes visibility and notifications", () => {
  adminTest(
    "BR-063/064: a staff-added internal note is never visible to the submitting student",
    async ({ browser }) => {
      const studentContext = await browser.newContext({
        storageState: "tests/e2e/.auth/student.json",
      });
      const studentPage = await studentContext.newPage();
      const { id } = await submitComplaint(
        studentPage,
        "Grade Concern",
        `E2E notes ${Date.now()}`,
        "Automated E2E test complaint for note-visibility verification. Safe to ignore.",
      );

      const staffContext = await browser.newContext({ storageState: "tests/e2e/.auth/staff.json" });
      const staffPage = await staffContext.newPage();
      await staffPage.goto(`/staff/complaints/${id}`);

      const secretNote = `e2e-secret-note-${Date.now()}`;
      await staffPage
        .getByPlaceholder("Add an internal note…")
        .fill(secretNote);
      await staffPage.getByRole("button", { name: "Add Note" }).click();
      await expect(staffPage.getByText(secretNote)).toBeVisible();
      await staffContext.close();

      // The student's own complaint page has no Notes section at all (see
      // src/app/student/complaints/[id]/page.tsx — it never imports
      // NotesSection), so the note text cannot appear there under any
      // circumstance.
      await studentPage.goto(`/student/complaints/${id}`);
      await expect(studentPage.getByText(secretNote)).toHaveCount(0);
      await expect(studentPage.getByText(/internal note/i)).toHaveCount(0);

      // Belt and suspenders: the notes API itself also 403s a student.
      const notesApiRes = await studentPage.request.get(`/api/complaints/${id}/notes`);
      expect(notesApiRes.status()).toBe(403);
      await studentContext.close();
    },
  );

  adminTest(
    "BR-071/073: a status-change notification appears unread for the student, then flips to read once opened",
    async ({ browser }) => {
      const studentContext = await browser.newContext({
        storageState: "tests/e2e/.auth/student.json",
      });
      const studentPage = await studentContext.newPage();
      const { id } = await submitComplaint(
        studentPage,
        "Grade Concern",
        `E2E notifications ${Date.now()}`,
        "Automated E2E test complaint for notification verification. Safe to ignore.",
      );

      const staffContext = await browser.newContext({ storageState: "tests/e2e/.auth/staff.json" });
      const staffPage = await staffContext.newPage();
      await staffPage.goto(`/staff/complaints/${id}`);
      await staffPage.getByRole("button", { name: "Pick Up This Complaint" }).click();
      await expect(staffPage.getByRole("combobox")).toBeVisible({ timeout: 30_000 });
      await staffPage.getByRole("combobox").click();
      await staffPage.getByRole("option", { name: "In Progress", exact: true }).click();
      await staffPage.getByRole("button", { name: "Update Status" }).click();
      await expect(staffPage.getByText(/status updated to/i)).toBeVisible();
      await staffContext.close();

      // BR-071: unread notification shows up for the student.
      await studentPage.goto("/student/notifications");
      await studentPage.getByRole("button", { name: "Unread" }).click();
      const notificationRow = studentPage.getByText("Complaint status updated").first();
      await expect(notificationRow).toBeVisible();

      const unreadBefore = await studentPage.request
        .get("/api/notifications?unreadOnly=true")
        .then((r) => r.json());
      expect(unreadBefore.unreadCount).toBeGreaterThan(0);

      // BR-073: opening it marks it read. The mark-read PATCH fires from
      // the Link's onClick without being awaited before navigation, so poll
      // briefly rather than asserting on the very next tick.
      await notificationRow.click();
      await studentPage.waitForURL(/\/student\/complaints\//);

      await expect
        .poll(
          async () => {
            const afterRes = await studentPage.request.get("/api/notifications");
            const { notifications } = await afterRes.json();
            const thisOne = notifications.find((n: any) => n.relatedComplaintRef === id);
            return thisOne?.isRead;
          },
          { timeout: 10_000 },
        )
        .toBe(true);

      await studentContext.close();
    },
  );
});
