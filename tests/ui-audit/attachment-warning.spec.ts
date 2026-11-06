import { test, expect } from "@playwright/test";

test("complaint stays submitted and explains a rejected attachment", async ({ browser }) => {
  expect(process.env.UI_AUDIT_ISOLATED).toBe("1");
  const context = await browser.newContext({ baseURL: process.env.PLAYWRIGHT_BASE_URL });
  try {
    const page = await context.newPage();
    await page.goto("/login");
    await page.getByLabel("Email", { exact: true }).fill("student@parsu.edu.ph");
    await page.getByLabel("Password", { exact: true }).fill("ParSU_test2026");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.waitForURL("/student/dashboard");

    await page.goto("/student/complaints/new");
    await page.getByRole("combobox", { name: "Category", exact: true }).click();
    await page.getByRole("option", { name: "Student Services & Assistance", exact: true }).click();
    await page.getByRole("textbox", { name: "Title", exact: true }).fill("Attachment warning browser check");
    await page
      .getByRole("textbox", { name: "Description", exact: true })
      .fill("Check that a rejected attachment is reported after the complaint is saved.");
    await page.locator("#attachments").setInputFiles({
      name: "unsupported.exe",
      mimeType: "application/x-msdownload",
      buffer: Buffer.from("not an allowed attachment"),
    });
    await page.getByRole("button", { name: "Submit Complaint", exact: true }).click();

    await page.waitForURL(/\/student\/complaints\/[a-f0-9]{24}\?attachmentWarning=/);
    const complaintId = new URL(page.url()).pathname.split("/").pop()!;
    const warning = page.locator('[role="alert"]').filter({ hasText: "Your complaint was submitted" });
    await expect(warning).toContainText("Your complaint was submitted");
    await expect(warning).toContainText("failed to attach: unsupported.exe");
    const complaintResponse = await page.request.get(`/api/complaints/${complaintId}`);
    expect(complaintResponse.status()).toBe(200);
    expect((await complaintResponse.json()).complaint.title).toBe("Attachment warning browser check");
  } finally {
    await context.close();
  }
});
