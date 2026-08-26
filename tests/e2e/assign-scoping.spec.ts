// tests/e2e/assign-scoping.spec.ts — BR-047, BR-048, BR-049, BR-050, BR-051, BR-052
//
// The Assignment collection (src/models/Assignment.ts) is never exposed via
// any API route, so "multiple assignment records" is verified through its
// 1:1-correlated ComplaintTimeline entries instead (every POST
// /api/complaints/[id]/assign creates exactly one Assignment doc AND one
// "assigned"/"reassigned" timeline entry in the same request — see
// src/app/api/complaints/[id]/assign/route.ts). BR-050's system-originated
// initial record (assignedByRef: null) creates no timeline entry at all
// (only the Assignment doc, at complaint-creation time) — evidenced here
// indirectly via `assignedOfficeRef` already being set immediately after
// submission, before any human assignment action has happened.
import { adminTest, expect } from "./fixtures";
import { submitComplaint, loginAs, generatedStudentEmail } from "./helpers";

adminTest.describe("Assignment scoping", () => {
  adminTest(
    "BR-047/048/049/050/051/052: same-office/college assignment succeeds, cross-office/college is 403, admin is unrestricted, and reassignment produces distinct history entries",
    async ({ page: adminPage, browser, request }) => {
      // --- Complaint A: filed by student@parsu.edu.ph (CECS college),
      // category "Grade Concern" routes to the Registrar's office — same
      // office as staff@parsu.edu.ph, same college as dean@parsu.edu.ph. ---
      const studentContext = await browser.newContext({
        storageState: "tests/e2e/.auth/student.json",
      });
      const studentPage = await studentContext.newPage();
      const { id: complaintA } = await submitComplaint(
        studentPage,
        "Grade Concern",
        `E2E assign-scope A ${Date.now()}`,
        "Automated E2E test complaint for assignment-scoping verification. Safe to ignore.",
      );
      await studentContext.close();

      // BR-050: routed to an office immediately, before any human ever
      // touched assignment — proof the first Assignment record is
      // system-originated (assignedByRef: null), not created by a person.
      const freshRes = await adminPage.request.get(`/api/complaints/${complaintA}`);
      const { complaint: freshComplaint, timeline: freshTimeline } = await freshRes.json();
      expect(freshComplaint.assignedOfficeRef).toBeTruthy();
      expect(freshTimeline.some((e: any) => e.eventType === "assigned" || e.eventType === "reassigned")).toBe(
        false,
      );

      // --- Staff (Registrar office) self-assigns complaint A: same office, succeeds. ---
      const staffContext = await browser.newContext({ storageState: "tests/e2e/.auth/staff.json" });
      const staffPage = await staffContext.newPage();
      await staffPage.goto(`/staff/complaints/${complaintA}`);
      await staffPage.getByRole("button", { name: "Pick Up This Complaint" }).click();
      await expect(staffPage.getByRole("combobox")).toBeVisible(); // status form only shows once assigned to *this* staff member

      // --- Staff cross-office attempt on a DIFFERENT complaint: 403. ---
      const staffSession = await staffPage.request.get("/api/auth/session").then((r) => r.json());
      const staffId = staffSession.user.id;

      const studentContext2 = await browser.newContext({
        storageState: "tests/e2e/.auth/student.json",
      });
      const studentPage2 = await studentContext2.newPage();
      const { id: complaintB } = await submitComplaint(
        studentPage2,
        "Restroom & Sanitation", // routes to General Services Office, NOT the Registrar
        `E2E assign-scope B ${Date.now()}`,
        "Automated E2E test complaint for cross-office scoping. Safe to ignore.",
      );
      await studentContext2.close();

      // Staff can't even view a complaint outside their own office — the
      // page component's own `notFound()` renders the app's not-found
      // content (checked here) rather than the complaint; note this app's
      // custom `src/app/not-found.tsx` is a Client Component and its
      // response HTTP status is 200, not a true 404 — a separate, minor
      // technical quirk unrelated to whether the data itself is exposed.
      await staffPage.goto(`/staff/complaints/${complaintB}`);
      await expect(staffPage.getByText("Page not found")).toBeVisible();

      const crossOfficeRes = await staffPage.request.post(`/api/complaints/${complaintB}/assign`, {
        data: { assignedStaffRef: staffId },
      });
      expect(crossOfficeRes.status()).toBe(403);
      await staffContext.close();

      // --- Dean (CECS college) reassigns complaint A within their college:
      // moves it from the Registrar's office to General Services — allowed,
      // since the dean's scope is the *student's* college, not the office. ---
      const deanContext = await browser.newContext({ storageState: "tests/e2e/.auth/dean.json" });
      const deanPage = await deanContext.newPage();
      await deanPage.goto(`/dean/complaints/${complaintA}`);
      // ReassignForm's "Office" <label> isn't programmatically associated
      // with its Select trigger (no htmlFor/id) — it's the first of the
      // form's two comboboxes (Office, then Staff), so target by order.
      await deanPage.getByRole("combobox").first().click();
      await deanPage.getByRole("option", { name: "General Services Office", exact: true }).click();
      await deanPage.getByPlaceholder("Reason for reassignment (optional)").fill("e2e-dean-reassign");
      await deanPage.getByRole("button", { name: "Reassign" }).click();
      await expect(deanPage.getByText("Reassigned").first()).toBeVisible();

      // --- Dean cross-college attempt: a student from a DIFFERENT college
      // (index 1 = College of Education, not CECS) files a complaint; the
      // dean (CECS) is 403'd trying to touch it. ---
      const otherCollegeStudentEmail = generatedStudentEmail(1);
      const otherContext = await browser.newContext();
      const otherPage = await otherContext.newPage();
      await loginAs(otherPage, otherCollegeStudentEmail);
      const { id: complaintC } = await submitComplaint(
        otherPage,
        "Campus Wi-Fi & IT Infrastructure",
        `E2E assign-scope C ${Date.now()}`,
        "Automated E2E test complaint for cross-college scoping. Safe to ignore.",
      );
      await otherContext.close();

      await deanPage.goto(`/dean/complaints/${complaintC}`);
      await expect(deanPage.getByText("Page not found")).toBeVisible();

      const crossCollegeRes = await deanPage.request.post(`/api/complaints/${complaintC}/assign`, {
        data: { assignedStaffRef: "irrelevant-since-scope-check-runs-first" },
      });
      expect(crossCollegeRes.status()).toBe(403);
      await deanContext.close();

      // --- Admin is unrestricted: reassigns complaint C (cross-college,
      // never touched by the dean) to an arbitrary office. ---
      const officesRes = await adminPage.request.get("/api/offices");
      const { offices } = await officesRes.json();
      const qaOffice = offices.find((o: any) => o.name === "Quality Assurance Office");
      expect(qaOffice).toBeTruthy();

      const adminAssignRes = await adminPage.request.post(`/api/complaints/${complaintC}/assign`, {
        data: { assignedOfficeRef: qaOffice._id, message: "e2e-admin-unrestricted" },
      });
      expect(adminAssignRes.ok()).toBeTruthy();
      const { complaint: adminAssigned } = await adminAssignRes.json();
      expect(String(adminAssigned.assignedOfficeRef)).toBe(qaOffice._id);

      // --- BR-047/051/052: complaint A now has two distinct human
      // assignment actions (staff self-assign, then dean reassign) — two
      // separate timeline entries, proving two separate, immutable
      // Assignment records rather than one mutated in place. ---
      const finalRes = await adminPage.request.get(`/api/complaints/${complaintA}`);
      const { timeline: finalTimeline } = await finalRes.json();
      const assignmentEvents = finalTimeline.filter(
        (e: any) => e.eventType === "assigned" || e.eventType === "reassigned",
      );
      expect(assignmentEvents.length).toBeGreaterThanOrEqual(2);
      expect(assignmentEvents[0].eventType).toBe("assigned"); // staff self-assign
      expect(assignmentEvents[1].eventType).toBe("reassigned"); // dean's office move
    },
  );
});
