import { adminTest, expect } from "./fixtures";
import { submitComplaint } from "./helpers";
adminTest("centralized OSAS handling and clean oversight views", async ({ browser }) => {
  const student = await browser.newContext({ storageState: "tests/e2e/.auth/student.json" });
  const page = await student.newPage();
  const { id } = await submitComplaint(
    page,
    "Internet and Network",
    `Central OSAS ${Date.now()}`,
    "An internet concern must enter the single OSAS queue.",
  );
  const head = await browser.newContext({ storageState: "tests/e2e/.auth/osas.json" });
  const headPage = await head.newPage();
  await headPage.goto(`/admin/complaints/${id}`);
  await expect(headPage.getByRole("button", { name: "Assign Staff", exact: true })).toBeVisible();
  await expect(
    headPage.getByRole("button", { name: "Handle Personally", exact: true }),
  ).toBeVisible();
  await expect(headPage.getByRole("button", { name: "Reassign Office", exact: true })).toHaveCount(
    0,
  );
  const staff = await browser.newContext({ storageState: "tests/e2e/.auth/staff.json" });
  const session = await (await staff.request.get("/api/auth/session")).json();
  expect(
    (
      await staff.request.post(`/api/complaints/${id}/assign`, {
        data: { assignedStaffRef: session.user.id },
      })
    ).status(),
  ).toBe(403);
  await headPage.getByRole("button", { name: "Assign Staff", exact: true }).click();
  const dialog = headPage.getByRole("dialog");
  await expect(dialog.getByText("Assigned staff", { exact: false })).toBeVisible();
  const picker = dialog.getByRole("combobox").first();
  await picker.click();
  await headPage.getByRole("option", { name: "OSAS Staff Two", exact: true }).click();
  await dialog.getByRole("button", { name: "Assign Staff", exact: true }).click();
  await headPage.getByRole("button", { name: "Assign Staff", exact: true }).last().click();
  const detail = await (await staff.request.get(`/api/complaints/${id}`)).json();
  expect(detail.complaint.status).toBe("in_progress");
  expect(detail.complaint.assignedStaffRef).toBe(session.user.id);
  for (const role of ["vpaa", "vpaf"]) {
    const oversight = await browser.newContext({ storageState: `tests/e2e/.auth/${role}.json` });
    const view = await oversight.newPage();
    await view.goto(`/admin/complaints/${id}`);
    await expect(view.getByRole("heading", { name: /Central OSAS/ })).toBeVisible();
    for (const name of [
      "Assign Staff",
      "Handle Personally",
      "Change Assignee",
      "Update Status",
      "Reassign Office",
      "Request Archive",
    ]) {
      await expect(view.getByRole("button", { name, exact: true })).toHaveCount(0);
    }
    expect(
      (
        await oversight.request.post(`/api/complaints/${id}/assign`, {
          data: { assignedStaffRef: session.user.id },
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await oversight.request.patch(`/api/complaints/${id}`, { data: { status: "resolved" } })
      ).status(),
    ).toBe(403);
    await view.goto("/admin/dashboard");
    await expect(
      view.getByRole("heading", { name: `${role.toUpperCase()} oversight`, exact: true }),
    ).toBeVisible();
    await expect(view.getByRole("link", { name: "Reports", exact: true })).toBeVisible();
    await oversight.close();
  }
  await student.close();
  await head.close();
  await staff.close();
});
