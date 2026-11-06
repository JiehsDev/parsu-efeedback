import { test, expect, type BrowserContext } from "@playwright/test";

test("VPAA and VPAF heads assign formally forwarded complaints to their own staff", async ({
  browser,
}) => {
  test.setTimeout(600000);
  expect(process.env.UI_AUDIT_ISOLATED).toBe("1");
  const contexts: BrowserContext[] = [];
  async function login(email: string) {
    const context = await browser.newContext({ baseURL: process.env.PLAYWRIGHT_BASE_URL });
    contexts.push(context);
    const page = await context.newPage();
    page.setDefaultTimeout(60000);
    await page.goto("/login");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill("ParSU_test2026");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.waitForURL(/\/(student|admin|staff)\/dashboard/, { timeout: 120000 });
    return page;
  }
  try {
    const student = await login("student@parsu.edu.ph");
    const osas = await login("osasdirector@parsu.edu.ph");
    const vpaaStaff = await login("vpaa.staff1@parsu.edu.ph");
    const vpafStaff = await login("vpaf.staff1@parsu.edu.ph");
    const categories = (await (await student.request.get("/api/categories")).json()).categories;
    for (const role of ["vpaa", "vpaf"] as const) {
      const head = await login(`${role}@parsu.edu.ph`);
      const staff = role === "vpaa" ? vpaaStaff : vpafStaff;
      const otherStaff = role === "vpaa" ? vpafStaff : vpaaStaff;
      const category = categories.find(
        (row: any) =>
          row.name ===
          (role === "vpaa"
            ? "Teaching and Instruction Concerns"
            : "Campus Facilities and Maintenance"),
      );
      const created = await student.request.post("/api/complaints", {
        data: {
          categoryRef: category._id,
          title: `Receiving ${role} staff browser check`,
          description:
            "A complaint used only in the isolated receiving staff browser verification.",
        },
      });
      expect(created.status()).toBe(201);
      const complaint = (await created.json()).complaint;
      expect((await (await staff.request.get("/api/complaints")).json()).total).toBe(0);
      const forwarded = await osas.request.post(`/api/complaints/${complaint._id}/forwarding`, {
        data: {
          destination: role,
          direct: true,
          reason: "Receiving-office staff UI verification.",
        },
      });
      expect(forwarded.ok()).toBe(true);
      await head.goto(`/admin/complaints/${complaint._id}`);
      await head.getByRole("button", { name: "Change Assignee", exact: true }).click();
      const dialog = head.getByRole("dialog");
      await expect(dialog.getByRole("combobox").first()).toBeEnabled();
      await dialog.getByRole("combobox").first().click();
      const staffName = role === "vpaa" ? "Rafael Mendoza" : "Angela Bautista";
      await head.getByRole("option", { name: staffName, exact: true }).click();
      await dialog.getByRole("combobox").nth(1).click();
      await head.getByRole("option", { name: "Workload balancing", exact: true }).click();
      await dialog
        .getByRole("button", { name: /Save|Change|Assign/ })
        .last()
        .click();
      await head
        .getByRole("alertdialog")
        .getByRole("button", { name: "Change Assignee", exact: true })
        .click();
      await expect(head.getByRole("dialog")).toHaveCount(0);
      await staff.goto(`/staff/complaints/${complaint._id}`);
      await expect(staff.getByText("Update status", { exact: true })).toBeVisible();
      await expect(
        staff.getByRole("link", { name: "Forwarding Requests", exact: true }),
      ).toHaveCount(0);
      await expect(staff.getByText(staffName, { exact: true })).toBeVisible();
      await expect(staff.getByRole("button", { name: "Change Assignee", exact: true })).toHaveCount(
        0,
      );
      await expect(
        staff.getByRole("button", { name: "Release Assignment", exact: true }),
      ).toHaveCount(0);
      await staff.getByRole("combobox", { name: "Status", exact: true }).click();
      await staff.getByRole("option", { name: "Resolved", exact: true }).click();
      await staff
        .getByLabel("Resolution details", { exact: false })
        .fill(
          "The assigned receiving-office staff member reviewed and resolved the reported service concern.",
        );
      await staff.getByRole("button", { name: "Request Resolution Approval", exact: true }).click();
      const pending = (await (await staff.request.get(`/api/complaints/${complaint._id}/resolution-requests`)).json()).requests;
      expect(pending[0].status).toBe("pending");
      expect((await (await staff.request.get(`/api/complaints/${complaint._id}`)).json()).complaint.status).toBe("in_progress");
      await head.goto(`/admin/complaints/${complaint._id}`);
      await head.getByRole("button", { name: "Approve resolution", exact: true }).click();
      expect((await otherStaff.request.get(`/api/complaints/${complaint._id}`)).status()).toBe(403);
      const final = (await (await staff.request.get(`/api/complaints/${complaint._id}`)).json())
        .complaint;
      expect(final.status).toBe("resolved");
      expect(final.slaResolutionDueAt).toBe(complaint.slaResolutionDueAt);
      await staff.screenshot({
        path: `.local-backups/receiving-staff-${role}.png`,
        fullPage: true,
      });
      await head.close();
    }
  } finally {
    for (const context of contexts) await context.close();
  }
});
