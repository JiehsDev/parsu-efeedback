import { adminTest, expect, staffTest, studentTest } from "./fixtures";
import type { Page } from "@playwright/test";

async function checkViewport(page: Page, width: number, outputPath: string) {
  await page.setViewportSize({ width, height: 900 });
  await page.waitForLoadState("domcontentloaded");
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: outputPath, fullPage: true });
}

studentTest("student dashboard and complaint form remain usable on mobile", async ({ page }, testInfo) => {
  await page.goto("/student/dashboard");
  await checkViewport(page, 375, testInfo.outputPath("student-dashboard-mobile.png"));
  await page.goto("/student/complaints/new");
  await checkViewport(page, 375, testInfo.outputPath("student-complaint-form-mobile.png"));
});

studentTest("student notifications remain usable on tablet", async ({ page }, testInfo) => {
  await page.goto("/student/notifications");
  await checkViewport(page, 768, testInfo.outputPath("student-notifications-tablet.png"));
});

studentTest("student complaint detail remains readable on mobile", async ({ page }, testInfo) => {
  await page.goto("/student/complaints");
  await page.locator('a[href^="/student/complaints/"]').first().click();
  await checkViewport(page, 375, testInfo.outputPath("student-complaint-detail-mobile.png"));
});

staffTest("staff dashboard and SLA page remain usable on mobile", async ({ page }, testInfo) => {
  await page.goto("/staff/dashboard");
  await checkViewport(page, 375, testInfo.outputPath("staff-dashboard-mobile.png"));
  await page.goto("/staff/sla");
  await checkViewport(page, 375, testInfo.outputPath("staff-sla-mobile.png"));
});

staffTest("staff complaint queue remains usable on desktop", async ({ page }, testInfo) => {
  await page.goto("/staff/complaints");
  await checkViewport(page, 1366, testInfo.outputPath("staff-queue-desktop.png"));
});

staffTest("staff complaint detail remains readable on mobile", async ({ page }, testInfo) => {
  await page.goto("/staff/complaints");
  await page.locator('a[href^="/staff/complaints/"]').first().click();
  await checkViewport(page, 375, testInfo.outputPath("staff-complaint-detail-mobile.png"));
});

adminTest("administrator dashboard remains usable on tablet", async ({ page }, testInfo) => {
  await page.goto("/admin/dashboard");
  await checkViewport(page, 768, testInfo.outputPath("admin-dashboard-tablet.png"));
});

adminTest("administrator complaint detail remains readable on mobile", async ({ page }, testInfo) => {
  await page.goto("/admin/complaints");
  await page.locator('a[href^="/admin/complaints/"]').first().click();
  await checkViewport(page, 375, testInfo.outputPath("admin-complaint-detail-mobile.png"));
});

adminTest("office management remains usable on tablet", async ({ page }, testInfo) => {
  await page.goto("/admin/offices");
  await checkViewport(page, 768, testInfo.outputPath("admin-offices-tablet.png"));
});

adminTest("reports remain usable on mobile", async ({ page }, testInfo) => {
  await page.goto("/admin/reports");
  await checkViewport(page, 375, testInfo.outputPath("admin-reports-mobile.png"));
});

adminTest("audit logs remain usable on mobile", async ({ page }, testInfo) => {
  await page.goto("/admin/audit-logs");
  await checkViewport(page, 375, testInfo.outputPath("admin-audit-mobile.png"));
});
