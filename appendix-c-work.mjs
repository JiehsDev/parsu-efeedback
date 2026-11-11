import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const BASE = "http://localhost:3000";
const OUT = "appendix-c-assets";
await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1100 },
  deviceScaleFactor: 2,
});
const page = await context.newPage();

async function screenshot(name, selector) {
  await page.locator(selector).first().screenshot({ path: `${OUT}/${name}.png` });
}

async function login(email) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.locator("#email").fill(email);
  await page.locator("#password").fill("ParSU_test2026");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/(student|staff|admin)\/dashboard/, { timeout: 20000 });
  const session = await page.request.get(`${BASE}/api/auth/session`).then((r) => r.json());
  if (!session?.user) throw new Error("Login did not produce an authenticated test session.");
}

try {
  // Registration input and verification screen: fictional, unsubmitted verification code.
  await page.goto(`${BASE}/register`, { waitUntil: "networkidle" });
  await page.getByLabel("First name").fill("Sample");
  await page.getByLabel("Last name").fill("Student");
  await page.getByLabel("Student number").fill("SN-APP-C-20261110");
  await page.getByLabel("Email").fill("appendix.demo.20261110@parsu.edu.ph");
  await page.getByLabel("College").click();
  await page.getByRole("option").first().click();
  await page.locator("#password").fill("AppendixDemo-2026");
  await page.locator("#confirmPassword").fill("AppendixDemo-2026");
  await screenshot("C1_registration_input", "main > div");
  await page.getByRole("button", { name: "Need to verify a pending registration?" }).click();
  await page.waitForSelector("#verificationCode", { timeout: 5000 });
  await screenshot("C2_email_verification", "main > div");
  console.log("verification_interface=shown; code=not_entered_or_captured");

  // Seeded student account: fictional complaint and general feedback.
  await login("student@parsu.edu.ph");
  await page.goto(`${BASE}/student/complaints/new`, { waitUntil: "networkidle" });
  await page.locator("#categoryRef").click();
  await page.getByRole("option", { name: "Curriculum & Class Scheduling", exact: true }).click();
  await page.locator("#title").fill("Classroom schedule display needs correction");
  await page.locator("#description").fill(
    "For this demonstration, the posted schedule for Sample Room 204 on 10 November 2026 conflicts with the schedule shown in the university portal. Please confirm the correct schedule and update the notice.",
  );
  await screenshot("C3_complaint_input", ".reading-layout > div");
  let response = await page.request.get(`${BASE}/api/complaints?q=${encodeURIComponent("Classroom schedule display needs correction")}`).then((r) => r.json());
  let rows = response.complaints ?? response.data?.complaints ?? [];
  let created = rows.find((item) => item.title === "Classroom schedule display needs correction");
  if (!created) {
    await page.getByRole("button", { name: /submit complaint/i }).click();
    await page.waitForURL(/\/student\/complaints/, { timeout: 20000 });
    await page.waitForTimeout(800);
    response = await page.request.get(`${BASE}/api/complaints?q=${encodeURIComponent("Classroom schedule display needs correction")}`).then((r) => r.json());
    rows = response.complaints ?? response.data?.complaints ?? [];
    created = rows.find((item) => item.title === "Classroom schedule display needs correction");
  }
  if (!created) {
    console.log("complaintApiKeys=" + Object.keys(response).join(","));
    console.log("complaintApiStatus=" + (response.status ?? "none"));
    throw new Error("Demonstration complaint was not found in the student complaint list.");
  }
  console.log("ticket=" + created.ticketNumber);
  console.log("complaintId=" + created._id);
  console.log("initialStatus=" + created.status);
  console.log("assignedOfficePresent=" + Boolean(created.assignedOfficeRef));
  await page.goto(`${BASE}/student/complaints/${created._id}`, { waitUntil: "networkidle" });
  console.log("detailPath=" + new URL(page.url()).pathname);
  console.log("detailHeadingCount=" + (await page.locator("h1").count()));
  await screenshot("C6_ticket_header", ".workspace-page > div.flex");
  await page.getByText("Details", { exact: true }).locator("xpath=..").screenshot({ path: `${OUT}/C6_ticket_details.png` });

  await page.goto(`${BASE}/student/feedback/new`, { waitUntil: "networkidle" });
  await page.locator("#category").click();
  await page.getByRole("option", { name: "System Usability", exact: true }).click();
  await page.locator("#message").fill(
    "Demonstration feedback: The complaint list makes the ticket number and current status easy to find. The activity timeline makes each processing update clear.",
  );
  await screenshot("C4_feedback_input", "#message");
  await page.getByRole("button", { name: /send feedback|share feedback/i }).click();
  await page.getByText("Feedback sent", { exact: true }).waitFor({ timeout: 15000 });
  await screenshot("C4_feedback_submitted", "text=Feedback sent");
  console.log("feedback=sent");
} finally {
  await browser.close();
}
