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
  adminTest.setTimeout(180_000);

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
      const staffSession = await staffPage.request.get("/api/auth/session").then((r) => r.json());
      const staffId = staffSession.user.id;

      const selfAssignRes = await staffPage.request.post(`/api/complaints/${complaintA}/assign`, {
        data: { assignedStaffRef: staffId, message: "Self-assigned" },
      });
      expect(selfAssignRes.ok()).toBeTruthy();

      const pickedUpRes = await adminPage.request.get(`/api/complaints/${complaintA}`);
      const { complaint: pickedUpComplaint } = await pickedUpRes.json();
      expect(String(pickedUpComplaint.assignedStaffRef)).toBe(staffId);

      // --- Staff cross-office attempt on a DIFFERENT complaint: 403. ---
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

      // --- OFFICE REASSIGNMENT final rule: reassigning a complaint's office
      // is now exclusively an Office-Head action (Office.headUserRef), via
      // the dedicated POST /api/complaints/[id]/reassign-office endpoint.
      // VPAA is NOT Office.headUserRef for any college in the seed data
      // (each college's head is its own dean account), so VPAA can still
      // assign staff within a college it's scoped to, but can no longer
      // move the complaint to another office at all — neither through the
      // legacy /assign route (now rejects any office change outright) nor
      // through the new endpoint (not the office head). ---
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
      // change) — an "assigned" timeline entry, not "reassigned". Staff
      // assignment authority is unaffected by the office-reassignment rule.
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

      // VPAA can no longer move the office via the legacy /assign route.
      const vpaaLegacyReassignRes = await vpaaContext.request.post(
        `/api/complaints/${collegeComplaint}/assign`,
        { data: { assignedOfficeRef: otherCollegeOffice._id, message: "e2e-vpaa-reassign" } },
      );
      expect(vpaaLegacyReassignRes.status()).toBe(400);

      // Nor via the new dedicated endpoint, since VPAA isn't this college's
      // head.
      const vpaaNewReassignRes = await vpaaContext.request.post(
        `/api/complaints/${collegeComplaint}/reassign-office`,
        { data: { destinationOfficeRef: otherCollegeOffice._id, reasonCode: "other", reasonText: "e2e-vpaa-not-head" } },
      );
      expect(vpaaNewReassignRes.status()).toBe(403);

      // --- VPAA cross-category attempt: complaint B is assigned to a
      // university_office (General Services) — outside VPAA's office
      // category, so this is 403'd. ---
      const crossCategoryRes = await vpaaContext.request.post(`/api/complaints/${complaintB}/assign`, {
        data: { assignedStaffRef: "irrelevant-since-scope-check-runs-first" },
      });
      expect(crossCategoryRes.status()).toBe(403);
      await vpaaContext.close();

      // Administrator is unrestricted (bypasses both the head check and the
      // lateral-eligibility check) and performs the actual office move —
      // this is the complaint's second distinct human assignment action,
      // proving two separate immutable Assignment records rather than one
      // mutated in place (checked below via the timeline).
      const adminReassignCollegeRes = await adminPage.request.post(
        `/api/complaints/${collegeComplaint}/reassign-office`,
        { data: { destinationOfficeRef: otherCollegeOffice._id, reasonCode: "administrative_transfer", reasonText: "" } },
      );
      expect(adminReassignCollegeRes.ok()).toBeTruthy();
      const { complaint: adminReassignedCollege } = await adminReassignCollegeRes.json();
      expect(String(adminReassignedCollege.assignedOfficeRef)).toBe(otherCollegeOffice._id);
      expect(adminReassignedCollege.assignedStaffRef).toBeNull();

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
      // office regardless of category, via the new dedicated endpoint
      // (admin bypasses both the head check and the lateral-eligibility
      // check — QA Office isn't a lateral match for a university office by
      // the general rule, but admin isn't subject to that rule). ---
      const officesRes = await adminPage.request.get("/api/offices");
      const { offices } = await officesRes.json();
      const qaOffice = offices.find((o: any) => o.name === "Quality Assurance Office");
      expect(qaOffice).toBeTruthy();

      const adminAssignRes = await adminPage.request.post(`/api/complaints/${complaintC}/reassign-office`, {
        data: { destinationOfficeRef: qaOffice._id, reasonCode: "administrative_transfer", reasonText: "" },
      });
      expect(adminAssignRes.ok()).toBeTruthy();
      const { complaint: adminAssigned } = await adminAssignRes.json();
      expect(String(adminAssigned.assignedOfficeRef)).toBe(qaOffice._id);

      await adminPage.goto(`/admin/complaints/${complaintC}`);
      await expect(adminPage.getByRole("button", { name: "Assign Staff" })).toBeVisible();
      await expect(adminPage.getByRole("button", { name: "Reassign Office" })).toBeVisible();
      await expect(adminPage.locator("p").filter({ hasText: "Update status" })).toBeVisible();
      await expect(adminPage.getByText("Assignment & Escalation History")).toBeVisible();

      // --- BR-047/051/052: the college complaint now has two distinct
      // human assignment actions (VPAA staff-assign, then admin's office
      // reassignment via the new endpoint) — two separate timeline
      // entries, proving two separate, immutable Assignment records
      // rather than one mutated in place. ---
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

  adminTest(
    "OSAS can reassign student-affairs complaints, escalate to OVPAA, and cannot touch VPAF-only complaints",
    async ({ page: adminPage, browser }) => {
      const studentContext = await browser.newContext({
        storageState: "tests/e2e/.auth/student.json",
      });
      const studentPage = await studentContext.newPage();
      const { id: osasComplaint } = await submitComplaint(
        studentPage,
        "Student Services & Assistance",
        `E2E OSAS reassignment ${Date.now()}`,
        "Automated E2E complaint for OSAS scoped reassignment.",
      );
      const { id: vpafComplaint } = await submitComplaint(
        studentPage,
        "Student Payment & Cashier Concerns",
        `E2E OSAS blocked ${Date.now()}`,
        "Automated E2E complaint for OSAS blocked reassignment.",
      );
      await studentContext.close();

      const officesRes = await adminPage.request.get("/api/offices");
      const { offices } = await officesRes.json();
      const collegeOffice = offices.find((o: any) => o.type === "college_office");
      const ovpaaOffice = offices.find((o: any) => o.code === "OVPAA");
      const generalServicesOffice = offices.find((o: any) => o.code === "GSO");
      expect(collegeOffice).toBeTruthy();
      expect(ovpaaOffice).toBeTruthy();
      expect(generalServicesOffice).toBeTruthy();

      const osasContext = await browser.newContext({ storageState: "tests/e2e/.auth/osas.json" });
      const osasPage = await osasContext.newPage();

      // osas@parsu.edu.ph is Office.headUserRef for the OSAS office in the
      // seed data, so this actor IS the office head here — the new
      // "Reassign Office" action is visible and usable via the dedicated
      // endpoint.
      await osasPage.goto(`/admin/complaints/${osasComplaint}`);
      await expect(osasPage.getByRole("button", { name: "Reassign Office" })).toBeVisible();
      await expect(osasPage.getByRole("button", { name: "Escalate Complaint" })).toBeVisible();

      // The legacy /assign route no longer moves offices at all, for anyone.
      const invalidDestinationRes = await osasPage.request.post(`/api/complaints/${osasComplaint}/assign`, {
        data: {
          assignedOfficeRef: generalServicesOffice._id,
          message: "e2e-osas-invalid-destination",
        },
      });
      expect(invalidDestinationRes.status()).toBe(400);

      // Reassignment now goes through the dedicated, Office-Head-only
      // endpoint; a university office (OSAS) may hand off to a college.
      const reassignRes = await osasPage.request.post(`/api/complaints/${osasComplaint}/reassign-office`, {
        data: {
          destinationOfficeRef: collegeOffice._id,
          reasonCode: "belongs_to_another_office",
          reasonText: "e2e-osas-reassign",
        },
      });
      expect(reassignRes.ok()).toBeTruthy();
      const { complaint: reassigned } = await reassignRes.json();
      expect(String(reassigned.assignedOfficeRef)).toBe(collegeOffice._id);
      expect(reassigned.assignedStaffRef).toBeNull();

      // OSAS is not the head of the VPAF-scoped complaint's office, so the
      // dedicated endpoint correctly rejects this regardless of OSAS's
      // broader student-affairs action scope.
      const blockedRes = await osasPage.request.post(`/api/complaints/${vpafComplaint}/reassign-office`, {
        data: {
          destinationOfficeRef: collegeOffice._id,
          reasonCode: "other",
          reasonText: "e2e-osas-should-not-touch-vpaf",
        },
      });
      expect(blockedRes.status()).toBe(403);

      const escalationRes = await osasPage.request.post(`/api/complaints/${osasComplaint}/assign`, {
        data: {
          assignedOfficeRef: ovpaaOffice._id,
          assignedStaffRef: null,
          action: "escalate",
          message: "e2e-osas-escalate",
        },
      });
      expect(escalationRes.ok()).toBeTruthy();
      const { complaint: escalated } = await escalationRes.json();
      expect(escalated.status).toBe("escalated");
      expect(String(escalated.assignedOfficeRef)).toBe(ovpaaOffice._id);

      const finalRes = await adminPage.request.get(`/api/complaints/${osasComplaint}`);
      const { timeline } = await finalRes.json();
      expect(timeline.some((event: any) => event.eventType === "reassigned")).toBeTruthy();
      expect(timeline.some((event: any) => event.eventType === "escalated")).toBeTruthy();

      await osasPage.goto(`/admin/complaints/${osasComplaint}`);
      await expect(osasPage.getByText("Assignment & Escalation History")).toBeVisible();
      await osasContext.close();
    },
  );
});
