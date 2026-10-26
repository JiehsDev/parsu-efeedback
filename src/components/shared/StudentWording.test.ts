import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TimelineEvent } from "./TimelineEvent";
import { AssignmentHistoryPanel } from "./AssignmentHistoryPanel";
import { SlaDetails } from "./SlaDetails";
import { notificationCopy } from "@/lib/notification-copy";

describe("student-facing wording", () => {
  const event = {
    eventType: "complaint_forwarded",
    message: "OSAS transferred ownership to VPAA.",
    actorRef: { firstName: "Test", lastName: "Head", role: "osas" },
    createdAt: "2026-10-25T01:00:00Z",
  };
  it("keeps staff forwarding details out of student activity while preserving the staff view", () => {
    const student = renderToStaticMarkup(
      createElement(TimelineEvent, { event, viewerRole: "student" }),
    );
    expect(student).toContain("Review updated");
    expect(student).not.toMatch(/OSAS|VPAA|ownership|Test Head/);
    const staff = renderToStaticMarkup(createElement(TimelineEvent, { event }));
    expect(staff).toContain(event.message);
    expect(staff).toContain("Test Head");
  });
  it("preserves review dates without exposing internal assignment reasons", () => {
    const html = renderToStaticMarkup(
      createElement(AssignmentHistoryPanel, {
        simplified: true,
        entries: [
          {
            _id: "entry",
            kind: "forwarding",
            createdAt: event.createdAt,
            sourceOfficeName: "OSAS",
            destinationOfficeName: "VPAA",
            reason: "Internal capacity review",
          },
        ],
      }),
    );
    expect(html).toContain("Review updates");
    expect(html).toContain("<time");
    expect(html).not.toMatch(/OSAS|VPAA|Internal capacity review/);
  });
  it("retains both due dates in plain language", () => {
    const html = renderToStaticMarkup(
      createElement(SlaDetails, {
        simplified: true,
        complaint: {
          status: "in_progress",
          slaResponseDueAt: "2099-01-01T00:00:00Z",
          slaResolutionDueAt: "2099-01-02T00:00:00Z",
        },
      }),
    );
    expect(html).toContain("Response due");
    expect(html).toContain("Resolution due");
    expect(html).not.toMatch(/SLA|threshold|original/);
  });
  it.each(["Complaint forwarded", "Complaint routed to another office", "Complaint escalated"])(
    "also simplifies the older saved notice: %s",
    (title) => {
      const notice = {
        type: "status_updated",
        title,
        body: "OSAS moved your complaint PARSU-2026-000001 to VPAA.",
      };
      expect(notificationCopy(notice, true).body).not.toMatch(/OSAS|VPAA/);
      expect(notificationCopy(notice, true).body).toContain("PARSU-2026-000001");
      expect(notificationCopy(notice, false)).toBe(notice);
    },
  );
  it("keeps public update messages and announcements intact", () => {
    for (const type of ["status_updated", "system_announcement"]) {
      const notice = { type, title: "Important update", body: "Please reply by Friday." };
      expect(notificationCopy(notice, true)).toBe(notice);
    }
  });
});
