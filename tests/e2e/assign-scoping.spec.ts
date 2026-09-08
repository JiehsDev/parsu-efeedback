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
    "BR-047/048/049/050/051/052: same-office assignment succeeds, cross-office is 403, admin is unrestricted, and reassignment produces distinct history entries",
    async ({ page: adminPage, browser, request }) => {
      // --- Complaint A: filed by student@parsu.edu.ph (CECS college),
      // category "Grade Concern" routes to the Registrar's office — same
      // office as staff@parsu.edu.ph. ---
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

      // --- VPAA reassigns a complaint routed to a college office: moves it
      // between two college offices — allowed, since both stay within
      // VPAA's office category (college_office). "Faculty & Teaching
      // Performance" routes to CECS (a college_office) per the seed data. ---
      const collegeComplaintStudentContext = await browser.newContext({
        storageState: "tests/e2e/.auth/student.json",
      });
      const collegeComplaintStudentPage = await collegeComplaintStudentContext.newPage();
      const { id: collegeComplaint } = await submitComplaint(
        collegeComplaintStudentPage,
        "Faculty & Teaching Performance",
        `E2E assign-scope college ${Date.now()}`,
        "Automated E2E test complaint for VPAA office-category scoping. Safe to ignore.",
      );
      await collegeComplaintStudentContext.close();

      const vpaaContext = await browser.newContext({ storageState: "tests/e2e/.auth/vpaa.json" });
      const officesForVpaaRes = await vpaaContext.request.get("/api/offices");
      const { offices: officesForVpaa } = await officesForVpaaRes.json();
      const primaryCollegeOffice = officesForVpaa.find(
        (o: any) => o.name === "College of Engineering & Computational Sciences",
      );
      const otherCollegeOffice = officesForVpaa.find(
        (o: any) => o.type === "college_office" && o.name !== "College of Engineering & Computational Sciences",
      );
      expect(primaryCollegeOffice).toBeTruthy();
      expect(otherCollegeOffice).toBeTruthy();

      // First human action: VPAA assigns a CECS staff member (no office
      // change) — an "assigned" timeline entry, not "reassigned".
      const staffInCollegeRes = await vpaaContext.request.get(
        `/api/offices/${primaryCollegeOffice._id}/staff`,
      );
      const { staff: staffInCollege } = await staffInCollegeRes.json();
      expect(staffInCollege.length).toBeGreaterThan(0);

      const vpaaAssignStaffRes = await vpaaContext.request.post(
        `/api/complaints/${collegeComplaint}/assign`,
        { data: { assignedStaffRef: staffInCollege[0]._id } },
      );
      expect(vpaaAssignStaffRes.ok()).toBeTruthy();

      // Second human action: VPAA moves the complaint to a different
      // college office — allowed, since both stay within VPAA's office
      // category (college_office) — a "reassigned" timeline entry.
      const vpaaReassignRes = await vpaaContext.request.post(
        `/api/complaints/${collegeComplaint}/assign`,
        { data: { assignedOfficeRef: otherCollegeOffice._id, message: "e2e-vpaa-reassign" } },
      );
      expect(vpaaReassignRes.ok()).toBeTruthy();
      const { complaint: vpaaAssigned } = await vpaaReassignRes.json();
      expect(String(vpaaAssigned.assignedOfficeRef)).toBe(otherCollegeOffice._id);

      // --- VPAA cross-category attempt: complaint B is assigned to a
      // university_office (General Services) — outside VPAA's office
      // category, so this is 403'd. ---
      const crossCategoryRes = await vpaaContext.request.post(`/api/complaints/${complaintB}/assign`, {
        data: { assignedStaffRef: "irrelevant-since-scope-check-runs-first" },
      });
      expect(crossCategoryRes.status()).toBe(403);
      await vpaaContext.close();

      // --- A student from a different college (index 1 = College of
      // Education, not CECS) files a complaint routed to a university
      // office — used below to prove admin's unrestricted access. ---
      const otherCollegeStudentEmail = generatedStudentEmail(1);
      const otherContext = await browser.newContext();
      const otherPage = await otherContext.newPage();
      await loginAs(otherPage, otherCollegeStudentEmail);
      const { id: complaintC } = await submitComplaint(
        otherPage,
        "Campus Wi-Fi & IT Infrastructure",
        `E2E assign-scope C ${Date.now()}`,
        "Automated E2E test complaint for admin unrestricted-access scoping. Safe to ignore.",
      );
      await otherContext.close();

      // --- Admin is unrestricted: reassigns complaint C to an arbitrary
      // office regardless of category. ---
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

      // --- BR-047/051/052: the college complaint now has two distinct
      // human assignment actions (VPAA staff-assign, then VPAA office
      // reassign) — two separate timeline entries, proving two separate,
      // immutable Assignment records rather than one mutated in place. ---
      const finalRes = await adminPage.request.get(`/api/complaints/${collegeComplaint}`);
      const { timeline: finalTimeline } = await finalRes.json();
      const assignmentEvents = finalTimeline.filter(
        (e: any) => e.eventType === "assigned" || e.eventType === "reassigned",
      );
      expect(assignmentEvents.length).toBeGreaterThanOrEqual(2);
      expect(assignmentEvents[0].eventType).toBe("assigned"); // VPAA staff-assign
      expect(assignmentEvents[1].eventType).toBe("reassigned"); // VPAA's office move
    },
  );
});
