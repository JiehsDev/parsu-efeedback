// tests/e2e/analytics.spec.ts — BR-089, BR-095
import { studentTest, vpaaTest, qaTest, expect } from "./fixtures";

studentTest(
  "BR-089/095: a student has no analytics access — no UI entry point, and 403 at the API",
  async ({ page, request }) => {
    await page.goto("/student/dashboard");
    await expect(page.getByRole("link", { name: /analytics/i })).toHaveCount(0);

    const res = await request.get("/api/analytics/trends");
    expect(res.status()).toBe(403);
  },
);

vpaaTest(
  "BR-089: a scoped sub-admin (vpaa) gets 403 from the institution-wide analytics endpoint — its analytics come from the scoped /admin/dashboard instead",
  async ({ request }) => {
    const res = await request.get("/api/analytics/trends");
    expect(res.status()).toBe(403);
  },
);

qaTest(
  "BR-095: QA sees institution-wide analytics data but has no complaint-mutation rights",
  async ({ request }) => {
    const res = await request.get("/api/analytics/trends");
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    // Institution-wide: qa_office/administrator get a real college comparison.
    expect(data.collegeComparison).not.toBeNull();

    const listRes = await request.get("/api/complaints?limit=1");
    const { complaints } = await listRes.json();
    expect(complaints.length).toBeGreaterThan(0);
    const complaintId = complaints[0]._id;

    // BR-095: "no write access to complaint content" — assignment is
    // explicitly blocked for qa_office in the assign route.
    const assignRes = await request.post(`/api/complaints/${complaintId}/assign`, {
      data: { assignedStaffRef: "000000000000000000000000" },
    });
    expect(assignRes.status()).toBe(403);

    // Status changes SHOULD equally be blocked per BR-095, but
    // PATCH /api/complaints/[id] (src/app/api/complaints/[id]/route.ts)
    // only checks `role === "student"` before allowing a status change —
    // qa_office is not excluded. Asserting the documented/correct behavior
    // here; if it fails, that's a real BR-095 enforcement gap in the app,
    // not a test bug (see the final report).
    const statusRes = await request.patch(`/api/complaints/${complaintId}`, {
      data: { status: "in_progress" },
    });
    expect(statusRes.status()).toBe(403);
  },
);
