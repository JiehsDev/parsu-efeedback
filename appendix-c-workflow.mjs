import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const BASE = "http://localhost:3000";
const OUT = "appendix-c-assets";
const ID = "6af28a9b9db8cbe3efffb945";
const TICKET = "PARSU-2026-029033";
await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ headless: true });
const contexts = [];

async function makeSession(email, role) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 2 });
  contexts.push(context);
  const page = await context.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.locator("#email").fill(email);
  await page.locator("#password").fill("ParSU_test2026");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/(student|staff|admin)\/dashboard/, { timeout: 20000 });
  const session = await page.request.get(`${BASE}/api/auth/session`).then((r) => r.json());
  if (session?.user?.role !== role) throw new Error(`Expected seeded role ${role}; authenticated role mismatch.`);
  return page;
}

async function safeDetailsCrop(page, name) {
  const entries = page.locator(".reading-layout aside dl > div");
  if ((await entries.count()) < 8) throw new Error("Complaint details panel did not contain expected fields.");
  await entries.nth(2).scrollIntoViewIfNeeded();
  const first = await entries.nth(2).boundingBox();
  const last = await entries.nth(7).boundingBox();
  const aside = await page.locator(".reading-layout aside").boundingBox();
  await page.screenshot({
    path: `${OUT}/${name}.png`,
    clip: { x: aside.x, y: first.y, width: aside.width, height: last.y + last.height - first.y },
  });
}

async function state(page) {
  const result = await page.request.get(`${BASE}/api/complaints/${ID}`).then((r) => r.json());
  return result.complaint;
}

try {
  // OSAS Office Head assigns the complaint to a regular OSAS handler.
  let page = await makeSession("osasdirector@parsu.edu.ph", "osas");
  await page.goto(`${BASE}/staff/complaints/${ID}`, { waitUntil: "networkidle" });
  let complaint = await state(page);
  if (!complaint.assignedStaffRef) {
    await page.getByRole("button", { name: "Assign Staff", exact: true }).first().click();
    await page.getByRole("dialog").getByRole("combobox").click();
    await page.getByRole("option", { name: "OSAS Staff 2", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Assign Staff", exact: true }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Assign Staff", exact: true }).click();
    await page.getByText("Complaint assigned", { exact: true }).waitFor({ timeout: 15000 });
    complaint = await state(page);
  }
  await safeDetailsCrop(page, "C6_ticket_category_office");
  console.log("assignedStatus=" + complaint.status);

  // Capture only the current test ticket in the live SLA Tracker.
  await page.goto(`${BASE}/staff/sla`, { waitUntil: "networkidle" });
  await page.locator("#sla-search").fill(TICKET);
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await page.waitForLoadState("networkidle");
  const slaRow = page.locator(`a[href="/staff/complaints/${ID}"]`);
  if (!(await slaRow.count())) throw new Error("Assigned test ticket was not visible in the SLA Tracker.");
  await slaRow.screenshot({ path: `${OUT}/C12_sla_tracker.png` });
  console.log("slaRowCaptured=true");

  // Assigned OSAS staff prepares the controlled forwarding request to VPAA.
  page = await makeSession("osas.staff2@parsu.edu.ph", "office_staff");
  await page.goto(`${BASE}/staff/complaints/${ID}`, { waitUntil: "networkidle" });
  let forwarding = await page.request.get(`${BASE}/api/complaints/${ID}/forwarding`).then((r) => r.json());
  if (!(forwarding.requests ?? []).length) {
    await page.getByRole("button", { name: "Request Forwarding", exact: true }).click();
    await page.locator(`#forward-destination-${ID}`).selectOption("vpaa");
    await page.locator(`#forward-reason-${ID}`).fill(
      "Forward this sample class-schedule concern to VPAA for confirmation of the applicable timetable and guidance on the university portal notice.",
    );
    await page.locator("section").filter({ has: page.getByRole("heading", { name: "Forwarding", exact: true }) }).screenshot({ path: `${OUT}/C5_forwarding_request.png` });
    await page.getByRole("button", { name: "Submit Forwarding Request", exact: true }).click();
    await page.getByText("Forwarding request submitted.", { exact: true }).waitFor({ timeout: 15000 });
  }
  forwarding = await page.request.get(`${BASE}/api/complaints/${ID}/forwarding`).then((r) => r.json());
  console.log("forwardingStatus=" + (forwarding.requests?.[0]?.status ?? "unavailable"));

  // OSAS Office Head approves the pending request.
  page = await makeSession("osasdirector@parsu.edu.ph", "osas");
  await page.goto(`${BASE}/staff/complaints/${ID}`, { waitUntil: "networkidle" });
  forwarding = await page.request.get(`${BASE}/api/complaints/${ID}/forwarding`).then((r) => r.json());
  if (forwarding.requests?.[0]?.status === "pending") {
    await page.getByRole("button", { name: "Approve Forwarding", exact: true }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Approve Forwarding", exact: true }).click();
    await page.waitForURL(/\/staff\/forwarding-requests/, { timeout: 20000 });
  }
  const approvedCard = page.locator("article").filter({ hasText: TICKET }).first();
  if (await approvedCard.count()) await approvedCard.screenshot({ path: `${OUT}/C8_forwarding_approval_record.png` });
  forwarding = await page.request.get(`${BASE}/api/complaints/${ID}/forwarding`).then((r) => r.json());
  console.log("approvedForwarding=" + (forwarding.requests?.[0]?.status === "approved"));

  // VPAA Office Head processes the forwarded complaint and records a resolution.
  page = await makeSession("vpaa@parsu.edu.ph", "vpaa");
  await page.goto(`${BASE}/staff/complaints/${ID}`, { waitUntil: "networkidle" });
  complaint = await state(page);
  if (complaint.status !== "resolved") {
    await page.locator("#status-update-status").click();
    await page.getByRole("option", { name: "Resolved", exact: true }).click();
    await page.locator("#resolution-summary").fill(
      "The receiving office confirmed the demonstration schedule, updated the sample notice for Room 204, and verified the corrected timetable.",
    );
    await page.locator("#status-update-note").fill("Sample case reviewed and resolved by the receiving office head.");
    await page.getByRole("button", { name: "Update Status", exact: true }).click();
    for (let i = 0; i < 15; i++) {
      await page.waitForTimeout(500);
      complaint = await state(page);
      if (complaint.status === "resolved") break;
    }
  }
  if (complaint.status !== "resolved") throw new Error("VPAA resolution status was not recorded.");
  await page.locator("#resolution-details-heading").locator("xpath=..").screenshot({ path: `${OUT}/C9_resolution_details.png` });
  console.log("resolutionStatus=" + complaint.status);

  // Verify the receiving office through the actual complaint detail fields.
  await safeDetailsCrop(page, "C8_receiving_office");

  // Student-facing status history and system notification, cropped to the sample ticket only.
  page = await makeSession("student@parsu.edu.ph", "student");
  await page.goto(`${BASE}/student/complaints/${ID}`, { waitUntil: "networkidle" });
  const timeline = page.getByRole("heading", { name: "Timeline", exact: true }).locator("xpath=../..");
  const events = timeline.locator("div.relative.pb-6.pl-6");
  if ((await events.count()) < 3) throw new Error("Complaint history did not contain the recorded processing events.");
  const start = await events.nth(1).boundingBox(); // skip the student identity on the submission event
  const end = await events.last().boundingBox();
  const timelineBox = await timeline.boundingBox();
  await page.screenshot({
    path: `${OUT}/C7_status_activity_history.png`,
    clip: { x: timelineBox.x, y: start.y, width: timelineBox.width, height: end.y + end.height - start.y },
  });
  await page.goto(`${BASE}/student/notifications`, { waitUntil: "networkidle" });
  const notification = page.locator("li").filter({ hasText: TICKET }).last();
  if (!(await notification.count())) throw new Error("No student notification was found for the demonstration ticket.");
  await notification.screenshot({ path: `${OUT}/C10_system_notification.png` });
  console.log("studentNotificationCaptured=true");
} finally {
  await Promise.all(contexts.map((context) => context.close()));
  await browser.close();
}
