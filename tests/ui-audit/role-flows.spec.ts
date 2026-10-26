import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import { MongoClient } from "mongodb";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";

test.describe.configure({ mode: "default", timeout: 600000 });
const accounts = {
  student: "student@parsu.edu.ph",
  head: "osasdirector@parsu.edu.ph",
  handler: "osas.staff@parsu.edu.ph",
  colleague: "staff2@parsu.edu.ph",
  admin: "admin@parsu.edu.ph",
  vpaa: "vpaa@parsu.edu.ph",
  vpaf: "vpaf@parsu.edu.ph",
};
type Role = keyof typeof accounts;
const pages = {} as Record<Role, Page>;
const contexts: BrowserContext[] = [];
let complaintId = "";

async function login(page: Page, email: string, password = "ParSU_test2026") {
  page.setDefaultTimeout(60000);
  page.setDefaultNavigationTimeout(120000);
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL(/\/(student|staff|admin)\/dashboard/, { timeout: 180000 });
}
async function select(page: Page, label: string, option: string) {
  console.log(`Select ${label}: ${option}`);
  await page.getByRole("combobox", { name: label, exact: true }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}
async function submit(page: Page, title: string, attachment = false) {
  await page.goto("/student/complaints/new");
  await select(page, "Category", "Student Services & Assistance");
  await page.getByRole("textbox", { name: "Title", exact: true }).fill(title);
  await page
    .getByRole("textbox", { name: "Description", exact: true })
    .fill("Please review this student-services concern and provide a clear response.");
  if (attachment)
    await page.locator('input[type="file"]').setInputFiles({
      name: "support.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4\nAudit supporting document\n%%EOF"),
    });
  await page.getByRole("button", { name: "Submit Complaint", exact: true }).click();
  await page.waitForURL(/\/student\/complaints\?submitted=/);
  const list = await (await page.request.get("/api/complaints")).json();
  const complaint = list.complaints.find((item: any) => item.title === title);
  expect(complaint).toBeTruthy();
  return complaint._id as string;
}
async function checkState(page: Page, id: string, status: string) {
  await expect
    .poll(
      async () => (await (await page.request.get(`/api/complaints/${id}`)).json()).complaint.status,
      { timeout: 60000 },
    )
    .toBe(status);
}
async function resolve(page: Page, id: string) {
  await page.goto(`/staff/complaints/${id}`);
  await page.locator('#status, #next-status, [role="combobox"]').first().click();
  await page.getByRole("option", { name: "Resolved", exact: true }).click();
  await page
    .getByPlaceholder("Describe the actions taken and the outcome")
    .fill("OSAS verified the details and completed the requested assistance.");
  await page
    .getByPlaceholder("Add a message about this status change")
    .fill("Your concern has been reviewed and addressed.");
  await page.getByRole("button", { name: "Update Status", exact: true }).click();
  await checkState(page, id, "resolved");
}
async function assign(id: string) {
  const head = pages.head;
  await head.goto(`/admin/complaints/${id}`);
  await head.getByRole("button", { name: "Assign Staff", exact: true }).click();
  const dialog = head.getByRole("dialog", { name: "Assign Staff", exact: true });
  await expect(dialog.getByRole("combobox", { name: "Assigned staff", exact: true })).toBeVisible();
  await select(head, "Assigned staff", "OSAS Staff Two");
  await dialog.getByRole("button", { name: "Assign Staff", exact: true }).click();
  const confirmation = head.getByRole("alertdialog");
  await expect(confirmation.getByRole("button", { name: "Cancel", exact: true })).toBeFocused();
  await confirmation.getByRole("button", { name: "Assign Staff", exact: true }).click();
  await checkState(head, id, "in_progress");
}

test.beforeAll(async ({ browser }) => {
  test.setTimeout(600000);
  if (process.env.UI_AUDIT_ISOLATED !== "1" || !process.env.MONGODB_URI?.includes("127.0.0.1"))
    throw new Error("Run through npm run test:ui-audit; an isolated database is required.");
  const authDirectory = process.env.UI_AUDIT_AUTH_DIR;
  if (!authDirectory) throw new Error("Audit authentication directory is required");
  mkdirSync(authDirectory, { recursive: true });
  for (const role of Object.keys(accounts) as Role[]) {
    const storageState = join(authDirectory, `${role}.json`);
    const saved = existsSync(storageState);
    const context = await browser.newContext({
      baseURL: process.env.PLAYWRIGHT_BASE_URL,
      ...(saved ? { storageState } : {}),
    });
    contexts.push(context);
    pages[role] = await context.newPage();
    pages[role].setDefaultTimeout(60000);
    pages[role].setDefaultNavigationTimeout(120000);
    if (!saved) {
      await login(pages[role], accounts[role]);
      await context.storageState({ path: storageState });
    }
  }
  // Compile routes before entering forms: a first-time webpack compilation can
  // otherwise trigger Fast Refresh and discard the browser's in-progress input.
  const missingId = "000000000000000000000000";
  for (const path of [
    "/admin/complaints",
    "/admin/forwarding-requests",
    `/admin/complaints/${missingId}`,
    `/staff/complaints/${missingId}`,
    `/student/complaints/${missingId}`,
    "/student/complaints/new",
    "/student/complaints",
    "/api/categories",
    "/api/offices",
    `/api/offices/${missingId}/staff`,
    "/api/forwarding-requests",
  ]) {
    const page = path.startsWith("/student/")
      ? pages.student
      : path.startsWith("/staff/")
        ? pages.handler
        : pages.head;
    await page.request.get(path);
  }
  for (const path of [
    "/api/complaints",
    `/api/complaints/${missingId}`,
    `/api/complaints/${missingId}/assign`,
    `/api/complaints/${missingId}/attachments`,
    `/api/complaints/${missingId}/forwarding`,
    `/api/forwarding-requests/${missingId}`,
    `/api/complaints/${missingId}/information-request`,
    `/api/complaints/${missingId}/information-response`,
    `/api/complaints/${missingId}/close-without-rating`,
  ])
    await pages.head.request.fetch(path, { method: "OPTIONS" });
});
test.afterAll(async () => {
  for (const context of contexts) await context.close();
});

for (const destination of ["vpaa", "vpaf"] as const) {
  test(`controlled forwarding: ${destination.toUpperCase()} visibility, approval and receiving-office processing`, async () => {
    const { student, head, handler } = pages;
    const receiver = pages[destination];
    const excluded = pages[destination === "vpaa" ? "vpaf" : "vpaa"];
    const id = await submit(student, `UI controlled forwarding ${destination.toUpperCase()}`);
    await assign(id);
    await expect(
      head.getByRole("button", { name: "Forward Complaint", exact: true }),
    ).toBeVisible();
    const before = (await (await student.request.get(`/api/complaints/${id}`)).json()).complaint;
    for (const page of [receiver, excluded]) {
      expect((await page.request.get(`/api/complaints/${id}`)).status()).toBe(403);
      const result = await (
        await page.request.get(`/api/complaints?q=${encodeURIComponent(before.title)}`)
      ).json();
      expect(result.complaints).toHaveLength(0);
      await page.goto(`/admin/complaints?q=${encodeURIComponent(before.title)}`);
      await expect(page.getByText(before.title, { exact: true })).toHaveCount(0);
      expect((await page.goto(`/admin/complaints/${id}`))?.status()).toBe(404);
    }
    async function staffRequest() {
      await handler.goto(`/staff/complaints/${id}`);
      await expect(
        handler.getByRole("button", { name: "Approve Forwarding", exact: true }),
      ).toHaveCount(0);
      await handler.getByRole("button", { name: "Request Forwarding", exact: true }).click();
      await handler.getByLabel("Destination", { exact: true }).selectOption(destination);
      await handler
        .getByLabel("Forwarding reason", { exact: true })
        .fill("This concern requires the receiving office's review.");
      await handler.getByRole("button", { name: "Submit Forwarding Request", exact: true }).click();
      await expect(
        handler.getByText(`Pending forwarding to ${destination.toUpperCase()}`, { exact: true }),
      ).toBeVisible({ timeout: 60000 });
    }
    await staffRequest();
    const stillOsas = (await (await student.request.get(`/api/complaints/${id}`)).json()).complaint;
    expect(stillOsas.assignedOfficeRef).toBe(before.assignedOfficeRef);
    expect(stillOsas.assignedStaffRef).toBe(before.assignedStaffRef);
    expect((await receiver.request.get(`/api/complaints/${id}`)).status()).toBe(403);
    await head.goto("/admin/forwarding-requests");
    await expect(
      head.getByRole("heading", { name: "Forwarding Requests", exact: true }),
    ).toBeVisible();
    await head
      .locator("article")
      .filter({ hasText: before.title })
      .getByRole("link", { name: "Review complaint", exact: true })
      .first()
      .click();
    if (destination === "vpaf") {
      await head
        .getByLabel("Decision note (required to reject)", { exact: true })
        .fill("OSAS should first complete its review.");
      await head.getByRole("button", { name: "Reject Forwarding", exact: true }).click();
      await expect(head.getByText("Forwarding request rejected.", { exact: true })).toBeVisible({
        timeout: 60000,
      });
      const rejected = (await (await student.request.get(`/api/complaints/${id}`)).json())
        .complaint;
      expect(rejected.assignedOfficeRef).toBe(before.assignedOfficeRef);
      expect(rejected.assignedStaffRef).toBe(before.assignedStaffRef);
      await staffRequest();
      await head.goto(`/admin/complaints/${id}`);
    }
    await head.getByRole("button", { name: "Approve Forwarding", exact: true }).click();
    await head
      .getByRole("alertdialog")
      .getByRole("button", { name: "Approve Forwarding", exact: true })
      .click();
    await head.waitForURL("**/admin/forwarding-requests", { timeout: 60000 });
    await expect
      .poll(async () => (await receiver.request.get(`/api/complaints/${id}`)).status(), {
        timeout: 60000,
      })
      .toBe(200);
    expect((await excluded.request.get(`/api/complaints/${id}`)).status()).toBe(403);
    expect((await handler.request.get(`/api/complaints/${id}`)).status()).toBe(403);
    const forwarded = (await (await receiver.request.get(`/api/complaints/${id}`)).json())
      .complaint;
    expect(forwarded.forwardedToRole).toBe(destination);
    expect(forwarded.slaResolutionDueAt).toBe(before.slaResolutionDueAt);
    expect(forwarded.slaResponseDueAt).toBe(before.slaResponseDueAt);
    await receiver.goto(`/admin/complaints?q=${encodeURIComponent(before.title)}`);
    await expect(receiver.getByRole("link").filter({ hasText: before.title })).toBeVisible();
    await receiver.goto(`/admin/complaints/${id}`);
    await expect(
      receiver.getByRole("button", { name: "Update Status", exact: true }),
    ).toBeVisible();
    await expect(
      receiver.getByRole("button", { name: "Forward Complaint", exact: true }),
    ).toHaveCount(0);
    await receiver
      .getByRole("button", { name: "Request Additional Information", exact: true })
      .click();
    await receiver
      .getByLabel("Information requested", { exact: true })
      .fill("Please provide the supporting reference number.");
    await receiver.getByRole("button", { name: "Send request", exact: true }).click();
    await checkState(receiver, id, "pending_information");
    await student.goto(`/student/complaints/${id}`);
    await student
      .getByRole("textbox", { name: "Your response", exact: true })
      .fill("The reference is STUDENT-2026.");
    await student.getByRole("button", { name: "Submit Information", exact: true }).click();
    await checkState(receiver, id, "in_progress");
    await receiver.goto(`/admin/complaints/${id}`);
    await select(receiver, "Status", "Resolved");
    await receiver
      .getByPlaceholder("Describe the actions taken and the outcome")
      .fill("The receiving office reviewed the reference and resolved the concern.");
    await receiver.getByRole("button", { name: "Update Status", exact: true }).click();
    await checkState(receiver, id, "resolved");
    await student.goto(`/student/complaints/${id}`);
    await student.getByRole("button", { name: "Close Without Rating", exact: true }).click();
    await student
      .getByRole("alertdialog")
      .getByRole("button", { name: "Close Complaint", exact: true })
      .click();
    await checkState(student, id, "closed");
    for (const page of [receiver, excluded]) {
      const listed = await (await page.request.get("/api/complaints")).json();
      expect(listed.complaints.some((complaint: any) => complaint._id === id)).toBe(
        page === receiver,
      );
    }
  });
}

test("shared settings, feedback, announcements, admin account creation and head personal handling", async () => {
  const student = pages.student,
    admin = pages.admin,
    head = pages.head;
  await student.goto("/student/feedback/new");
  await select(student, "Category", "General Suggestion");
  await student
    .getByRole("textbox", { name: "Message", exact: true })
    .fill("UI audit suggestion: publish the student assistance schedule.");
  await student.getByRole("checkbox", { name: /Submit anonymously/ }).check();
  await student.getByRole("button", { name: "Send Feedback", exact: true }).click();
  await expect(student.getByText("Feedback sent", { exact: true })).toBeVisible();
  await head.goto("/admin/feedback");
  await expect(
    head.getByText("UI audit suggestion: publish the student assistance schedule.", {
      exact: true,
    }),
  ).toBeVisible();

  await admin.goto("/admin/notifications");
  await admin.getByRole("textbox", { name: "Title", exact: true }).fill("UI audit announcement");
  await admin
    .getByRole("textbox", { name: "Message", exact: true })
    .fill("Student assistance is available through OSAS.");
  await admin.getByRole("button", { name: "Send Announcement", exact: true }).click();
  await student.goto("/student/notifications");
  await expect(student.getByText("UI audit announcement", { exact: true })).toBeVisible();
  await student.getByRole("button", { name: "Mark all as read", exact: true }).click();
  await expect(student.getByRole("button", { name: "Mark all as read", exact: true })).toHaveCount(
    0,
  );

  await admin.goto("/admin/users");
  await admin.getByRole("button", { name: "Add User", exact: true }).click();
  const dialog = admin.getByRole("dialog", { name: "Add User", exact: true });
  for (const [label, value] of [
    ["First name", "Audit"],
    ["Last name", "Handler"],
    ["Email", "audit.handler@parsu.edu.ph"],
    ["Employee/Student ID", "AUDIT-HANDLER"],
    ["Password", "ParSU_test2026"],
  ] as const) {
    if (label === "Password") await dialog.getByLabel(/^Password/).fill(value);
    else await dialog.getByRole("textbox", { name: label, exact: true }).fill(value);
  }
  await select(admin, "Role", "Office Staff");
  await admin.getByRole("combobox", { name: "Office", exact: true }).click();
  await expect(admin.getByRole("option")).toHaveCount(1);
  await admin.getByRole("option").click();
  await dialog.getByRole("button", { name: "Create User", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await admin
    .getByRole("textbox", { name: "Search users", exact: true })
    .fill("audit.handler@parsu.edu.ph");
  await expect(admin.getByText("audit.handler@parsu.edu.ph", { exact: true })).toBeVisible();

  await student.goto("/student/profile");
  await student.getByRole("textbox", { name: "First name", exact: true }).fill("Elliot Audit");
  await student.getByRole("button", { name: "Save Changes", exact: true }).click();
  await expect(student.getByRole("status")).toContainText("Profile updated.");
  for (const theme of ["Blue", "Pink", "Lime", "Purple"]) {
    await student.getByRole("button", { name: "Choose color theme", exact: true }).click();
    await student
      .getByRole("radio", { name: new RegExp(theme, "i") })
      .locator("..")
      .click();
    await student.keyboard.press("Escape");
    await student.getByRole("switch", { name: "Dark mode", exact: true }).click();
    await expect(student.getByRole("switch", { name: "Dark mode", exact: true })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await student.getByRole("switch", { name: "Dark mode", exact: true }).click();
  }

  const id = await submit(student, "UI audit: personal handling");
  await head.goto(`/admin/complaints/${id}`);
  await head.getByRole("button", { name: "Handle Personally", exact: true }).click();
  await checkState(head, id, "in_progress");
  await head.locator('[role="combobox"]').first().click();
  await head.getByRole("option", { name: "Resolved", exact: true }).click();
  await head
    .getByPlaceholder("Describe the actions taken and the outcome")
    .fill("OSAS Head reviewed the concern and confirmed the assistance provided.");
  await head.getByRole("button", { name: "Update Status", exact: true }).click();
  await checkState(head, id, "resolved");
  await student.goto(`/student/complaints/${id}`);
  await student.getByRole("button", { name: /Close.*Without.*Rating/i }).click();
  await student
    .getByRole("alertdialog")
    .getByRole("button", { name: "Close Complaint", exact: true })
    .click();
  await checkState(student, id, "closed");

  for (const role of ["head", "vpaa", "vpaf"] as const) {
    for (const path of ["users", "offices", "categories", "sla-rules", "settings", "audit-logs"]) {
      const response = await pages[role].goto(`/admin/${path}`);
      expect(response?.status(), `${role} opened ${path}`).toBe(404);
    }
  }
  await student.getByRole("button", { name: "Account options", exact: true }).click();
  await student.getByRole("button", { name: /Sign out/i }).click();
  await student.waitForURL(/\/login/);
  // Restore the session for subsequent role checks.
  await login(student, accounts.student);
});

test("student submission, head assignment, office-wide reading, information request, resolution and rating", async () => {
  const student = pages.student,
    head = pages.head,
    handler = pages.handler,
    colleague = pages.colleague;
  complaintId = await submit(student, "UI audit: student assistance", true);
  await student.goto(`/student/complaints/${complaintId}`);
  await student.getByRole("button", { name: "Edit", exact: true }).click();
  await student
    .getByRole("textbox", { name: "Description", exact: true })
    .fill("Updated details: student assistance is needed before the next activity.");
  await student.getByRole("button", { name: "Save Changes", exact: true }).click();
  await expect(
    student.getByText("Updated details: student assistance is needed before the next activity.", {
      exact: true,
    }),
  ).toBeVisible();
  const files = await (
    await student.request.get(`/api/complaints/${complaintId}/attachments`)
  ).json();
  expect(files.attachments).toHaveLength(1);
  expect(
    (
      await student.request.get(
        `/api/complaints/${complaintId}/attachments/${files.attachments[0]._id}/download`,
      )
    ).ok(),
  ).toBe(true);
  await assign(complaintId);
  await colleague.goto(`/staff/complaints/${complaintId}`);
  await expect(
    colleague.getByText(/View only\. You can review this office complaint/),
  ).toBeVisible();
  await expect(colleague.getByRole("button", { name: "Update Status", exact: true })).toHaveCount(
    0,
  );
  expect(
    (
      await colleague.request.patch(`/api/complaints/${complaintId}`, {
        data: { status: "resolved" },
      })
    ).status(),
  ).toBe(403);
  await handler.goto(`/staff/complaints/${complaintId}`);
  await handler
    .getByPlaceholder("Add an internal note…")
    .fill("Verify the student activity reference before processing.");
  await handler.getByRole("button", { name: "Add Note", exact: true }).click();
  await handler
    .getByRole("button", { name: "Request Additional Information", exact: true })
    .click();
  await handler
    .getByLabel("Information requested", { exact: true })
    .fill("Please provide the activity date and reference number.");
  await handler.getByRole("button", { name: "Send request", exact: true }).click();
  await checkState(handler, complaintId, "pending_information");
  await student.goto(`/student/complaints/${complaintId}`);
  await expect(
    student.getByText("Verify the student activity reference before processing.", { exact: true }),
  ).toHaveCount(0);
  await student
    .getByRole("textbox", { name: "Your response", exact: true })
    .fill("The activity is next Monday; reference STUDENT-1042.");
  await student.getByRole("button", { name: "Submit Information", exact: true }).click();
  await checkState(handler, complaintId, "in_progress");
  await resolve(handler, complaintId);
  for (const [page, base] of [
    [colleague, "staff"],
    [head, "admin"],
    [student, "student"],
  ] as const) {
    await page.goto(`/${base}/complaints/${complaintId}`);
    await expect(
      page.getByText("Your concern has been reviewed and addressed.", { exact: true }).first(),
    ).toBeVisible();
  }
  await expect(colleague.getByRole("button", { name: "Add Note", exact: true })).toHaveCount(0);
  await head
    .getByLabel("Reason for reopening", { exact: true })
    .fill("The student requested a second verification of the resolution.");
  await head.getByRole("button", { name: "Reopen Complaint", exact: true }).click();
  await checkState(head, complaintId, "in_progress");
  await resolve(handler, complaintId);
  await student.goto(`/student/complaints/${complaintId}`);
  await student.getByRole("button", { name: "Rate Resolution", exact: true }).click();
  await student.getByRole("button", { name: "Rate 5 stars", exact: true }).click();
  await student.getByRole("button", { name: "Submit Rating", exact: true }).click();
  await checkState(student, complaintId, "closed");
  await head.goto(`/admin/complaints/${complaintId}`);
  await head
    .getByLabel("Reason for archiving", { exact: true })
    .fill("Complaint completed and acknowledged by student.");
  await head.getByRole("button", { name: "Archive Complaint", exact: true }).click();
  await expect
    .poll(
      async () =>
        (await (await head.request.get(`/api/complaints/${complaintId}`)).json()).complaint
          .isArchived,
    )
    .toBe(true);
  await colleague.goto("/staff/complaints/archived");
  await expect(colleague.getByRole("link", { name: /UI audit: student assistance/ })).toBeVisible();
  await head.goto(`/admin/complaints/${complaintId}`);
  await head
    .getByLabel("Reason for restoring", { exact: true })
    .fill("Restore for records review.");
  await head.getByRole("button", { name: "Restore Complaint", exact: true }).click();
  await expect
    .poll(
      async () =>
        (await (await head.request.get(`/api/complaints/${complaintId}`)).json()).complaint
          .isArchived,
    )
    .toBe(false);
});

test("student withdrawal, handler release, head review and archive approval", async () => {
  const student = pages.student,
    handler = pages.handler,
    head = pages.head;
  const withdrawn = await submit(student, "UI audit: withdrawn concern");
  await student.goto(`/student/complaints/${withdrawn}`);
  await student.getByRole("button", { name: "Withdraw", exact: true }).click();
  await student
    .getByRole("alertdialog")
    .getByRole("button", { name: "Withdraw", exact: true })
    .click();
  await checkState(student, withdrawn, "withdrawn");
  const id = await submit(student, "UI audit: review and archive");
  await assign(id);
  await handler.goto(`/staff/complaints/${id}`);
  await handler.getByRole("button", { name: "Release Assignment", exact: true }).click();
  await handler
    .getByRole("dialog", { name: "Release Assignment", exact: true })
    .getByRole("textbox")
    .fill("Handler unavailable; please assign another member of OSAS.");
  await handler.getByRole("button", { name: "Confirm Release", exact: true }).click();
  await checkState(head, id, "submitted");
  await assign(id);
  await handler.goto(`/staff/complaints/${id}`);
  await handler.getByRole("button", { name: "Request OSAS Head Review", exact: true }).click();
  await select(handler, "Reason for OSAS Head review", "OSAS Head review");
  await handler
    .getByRole("dialog")
    .getByRole("button", { name: "Request OSAS Head Review", exact: true })
    .click();
  await handler
    .getByRole("alertdialog")
    .getByRole("button", { name: "Request OSAS Head Review", exact: true })
    .click();
  await expect
    .poll(
      async () =>
        (await (await head.request.get(`/api/complaints/${id}`)).json()).complaint
          .supervisorReviewRequired,
    )
    .toBe(true);
  await head.goto(`/admin/complaints/${id}`);
  await head.getByRole("button", { name: "Change Assignee", exact: true }).click();
  await select(head, "Assigned staff", "OSAS Staff Two");
  await select(head, "Reason for reassignment", "Workload balancing");
  await head
    .getByRole("dialog")
    .getByRole("button", { name: "Change Assignee", exact: true })
    .click();
  await head
    .getByRole("alertdialog")
    .getByRole("button", { name: "Change Assignee", exact: true })
    .click();
  await handler.goto(`/staff/complaints/${id}`);
  await handler.getByRole("button", { name: "Request Archive", exact: true }).click();
  await handler
    .getByPlaceholder(/reason/i)
    .last()
    .fill("This concern duplicates a completed student-services complaint.");
  await handler.getByRole("button", { name: /Submit Request|Send Request/i }).click();
  await expect(
    handler.getByText("Archive request submitted for Office Head approval.", { exact: true }),
  ).toBeVisible({ timeout: 60000 });
  await head.goto(`/admin/complaints/${id}`);
  await head.getByRole("button", { name: "Approve Archive", exact: true }).click();
  await expect
    .poll(
      async () =>
        (await (await head.request.get(`/api/complaints/${id}`)).json()).complaint.isArchived,
    )
    .toBe(true);
});

test("all roles: reachable navigation, current statuses, mobile labels and receiving-office scope", async () => {
  const routes: Record<Role, string[]> = {
    student: [
      "dashboard",
      "complaints",
      "complaints/new",
      "feedback/new",
      "notifications",
      "profile",
    ],
    handler: [
      "dashboard",
      "complaints",
      "sla",
      "reports",
      "complaints/archived",
      "notifications",
      "profile",
    ],
    colleague: ["complaints", "complaints/archived"],
    head: [
      "dashboard",
      "complaints",
      "archive-requests",
      "complaints?archived=1",
      "reports",
      "feedback",
      "notifications",
      "profile",
    ],
    admin: [
      "dashboard",
      "complaints",
      "archive-requests",
      "complaints?archived=1",
      "reports",
      "users",
      "offices",
      "categories",
      "sla-rules",
      "notifications",
      "audit-logs",
      "settings",
      "profile",
    ],
    vpaa: ["dashboard", "complaints", "reports", "notifications", "profile"],
    vpaf: ["dashboard", "complaints", "reports", "notifications", "profile"],
  };
  for (const role of Object.keys(routes) as Role[]) {
    const page = pages[role];
    const base =
      role === "student" ? "student" : ["handler", "colleague"].includes(role) ? "staff" : "admin";
    for (const path of routes[role]) {
      const response = await page.goto(`/${base}/${path}`);
      expect(response?.status(), `${role}: ${path}`).toBeLessThan(400);
      await expect(page.getByText("Internal Server Error", { exact: true })).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: /Reassign Office|Assign to Me|Pick Up/i }),
      ).toHaveCount(0);
      const controls = await page
        .locator('input:not([type="hidden"]), textarea, select, button[role="combobox"]')
        .evaluateAll((elements) =>
          elements
            .filter((el) => {
              if (!(el as HTMLElement).offsetWidth || el.getAttribute("aria-hidden") === "true")
                return false;
              const name =
                el.getAttribute("aria-label") ||
                el.getAttribute("aria-labelledby") ||
                (el as HTMLInputElement).labels?.length;
              return (
                !name && !["submit", "button", "reset"].includes((el as HTMLInputElement).type)
              );
            })
            .map((el) => ({
              tag: el.tagName,
              placeholder: el.getAttribute("placeholder"),
              id: el.id,
            })),
        );
      expect(controls, `${role}: ${path} unlabeled controls`).toEqual([]);
      if (path.includes("archived") || (role === "student" && path === "complaints/new"))
        expect(
          await page.locator('nav[aria-label="Main navigation"] a[aria-current="page"]').count(),
        ).toBe(1);
    }
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(`/${base}/dashboard`);
    if (role !== "student") {
      await expect(
        page.getByRole("heading", { name: "Open complaints", exact: true }).first(),
      ).toBeVisible();
    }
    const unnamedLinks = await page
      .locator('nav[aria-label="Main navigation"] a')
      .evaluateAll(
        (links) =>
          links.filter((link) => !(link.getAttribute("aria-label") || link.textContent?.trim()))
            .length,
      );
    expect(unnamedLinks).toBe(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.getByRole("button", { name: "Account options", exact: true }).click();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "Account options", exact: true })).toBeFocused();
    await page.screenshot({
      path: `.local-backups/ui-audit-artifacts/${role}-mobile.png`,
      fullPage: true,
    });
    await page.setViewportSize({ width: 1364, height: 900 });
    if (["vpaa", "vpaf"].includes(role)) {
      const list = await (await page.request.get("/api/complaints")).json();
      for (const complaint of list.complaints) expect(complaint.forwardedToRole).toBe(role);
    }
  }
});

test("admin form labels, modal keyboard behavior, category creation and report formats", async () => {
  const admin = pages.admin;
  await admin.goto("/admin/users");
  await admin
    .getByRole("button", { name: /Add User|Create User/ })
    .first()
    .click();
  const dialog = admin.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("First name", { exact: false })).toBeVisible();
  for (let i = 0; i < 20; i++) {
    await admin.keyboard.press("Tab");
    expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true);
  }
  await admin.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(admin.getByRole("button", { name: /Add User|Create User/ }).first()).toBeFocused();
  await admin.goto("/admin/categories/new");
  await admin.getByLabel("Name", { exact: true }).fill("UI audit student service");
  await admin
    .getByRole("textbox", { name: "Description", exact: true })
    .fill("Student assistance for an isolated audit.");
  await admin.getByRole("button", { name: /Create|Save/ }).click();
  await admin.waitForURL(/\/admin\/categories$/);
  await admin.getByRole("link", { name: /UI audit student service/ }).click();
  await expect(
    admin.getByText("Use the category name and description to identify related concerns.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(admin.getByText("Routing rule", { exact: true })).toHaveCount(0);
  for (const format of ["CSV", "Excel", "PDF"]) {
    await admin.goto("/admin/reports");
    await select(admin, "Format", format);
    const generated = admin.waitForResponse(
      (response) =>
        response.url().endsWith("/api/reports/export") && response.request().method() === "POST",
    );
    await admin.getByRole("button", { name: "Generate Report", exact: true }).click();
    expect((await generated).ok()).toBe(true);
    const download = admin.getByRole("link", { name: "Download", exact: true }).first();
    await expect(download).toBeVisible();
    expect((await admin.request.get((await download.getAttribute("href"))!)).ok()).toBe(true);
    const print = admin.getByRole("link", { name: "Print", exact: true }).first();
    expect((await admin.request.get((await print.getAttribute("href"))!)).ok()).toBe(true);
  }
});

test("public registration, reset validation and successful password reset", async ({ browser }) => {
  const context = await browser.newContext({ baseURL: process.env.PLAYWRIGHT_BASE_URL });
  try {
    const page = await context.newPage();
    await page.goto("/register");
    await page.getByLabel("First name", { exact: true }).fill("UI");
    await page.getByLabel("Last name", { exact: true }).fill("Audit");
    await page.getByLabel("Student number", { exact: true }).fill("2026-99881");
    await page.getByLabel("Email", { exact: true }).fill("ui.audit@parsu.edu.ph");
    await page.getByLabel("College", { exact: true }).click();
    await page.getByRole("option").first().click();
    await page.getByLabel("Password", { exact: true }).fill("ParSU_test2026");
    await page.getByLabel("Confirm password", { exact: true }).fill("ParSU_test2026");
    await page.getByRole("button", { name: "Create account", exact: true }).click();
    await page.waitForURL(/\/login/);
    await page.goto("/forgot-password");
    await page.getByRole("button", { name: "Send reset link", exact: true }).click();
    await expect(page.getByLabel("Email", { exact: true })).toHaveAttribute("aria-invalid", "true");
    await page.getByLabel("Email", { exact: true }).fill("ui.audit@parsu.edu.ph");
    await page.getByRole("button", { name: "Send reset link", exact: true }).click();
    await expect(page.getByRole("status")).toBeVisible();
    // Simulate receipt of an email link; the reset itself uses the real UI and server action.
    const db = await MongoClient.connect(process.env.MONGODB_URI!);
    const token = "ui-audit-reset-token-for-isolated-browser-test";
    try {
      const user = await db.db().collection("users").findOne({ email: "ui.audit@parsu.edu.ph" });
      await db
        .db()
        .collection("password_reset_tokens")
        .insertOne({
          userRef: user!._id,
          tokenHash: createHash("sha256").update(token).digest("hex"),
          expiresAt: new Date(Date.now() + 3600000),
          usedAt: null,
          createdAt: new Date(),
        });
    } finally {
      await db.close();
    }
    await page.goto(`/reset-password/${token}`);
    await page.getByLabel("New password", { exact: true }).fill("ParSU_audit2026");
    await page.getByLabel("Confirm new password", { exact: true }).fill("ParSU_audit2026");
    await page.getByRole("button", { name: "Update password", exact: true }).click();
    await login(page, "ui.audit@parsu.edu.ph", "ParSU_audit2026");
  } finally {
    await context.close();
  }
});
