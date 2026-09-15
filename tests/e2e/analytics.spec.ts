import { adminTest, expect, staffTest, studentTest } from "./fixtures";

studentTest(
  "a student has no analytics access through the shared analytics API",
  async ({ page, request }) => {
    await page.goto("/student/dashboard");
    await expect(page.getByRole("link", { name: /analytics/i })).toHaveCount(0);

    const res = await request.get("/api/analytics/trends");
    expect(res.status()).toBe(403);
  },
);

adminTest("administrator sees analytics data", async ({ request }) => {
  const res = await request.get("/api/analytics/trends");
  expect(res.ok()).toBeTruthy();
  const data = await res.json();
  expect(data.collegeComparison).not.toBeNull();
});

adminTest("administrator sees resolution summary metrics on the dashboard", async ({ page }) => {
  await page.goto("/admin/dashboard");
  const metrics = page.getByRole("region", { name: "Resolution metrics" });
  await expect(metrics).toBeVisible();
  await expect(metrics.getByText("Avg. first response")).toBeVisible();
  await expect(metrics.getByText("Avg. resolution")).toBeVisible();
  await expect(metrics.getByText("SLA compliance")).toBeVisible();
});

staffTest("office staff sees office-scoped response metrics on the dashboard", async ({ page }) => {
  await page.goto("/staff/dashboard");
  await expect(page.getByText("Avg. first response")).toBeVisible();
  await expect(page.getByText("Avg. resolution")).toBeVisible();
  await expect(page.getByText("SLA compliance")).toBeVisible();
});
