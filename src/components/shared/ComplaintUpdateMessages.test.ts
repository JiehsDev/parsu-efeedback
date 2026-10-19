import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ComplaintUpdateMessages } from "./ComplaintUpdateMessages";

const update = {
  _id: "first",
  eventType: "status_changed",
  fromValue: "assigned",
  toValue: "in_progress",
  message: "Inspecting the room.\nElectrician contacted.",
  actorRef: { firstName: "Test", lastName: "Staff", role: "office_staff" },
  createdAt: new Date("2026-10-19T01:00:00Z"),
};

describe("complaint update messages", () => {
  it.each(["student", "staff", "admin"])(
    "shows saved messages with status and author for %s",
    (viewerRole) => {
      const html = renderToStaticMarkup(
        createElement(ComplaintUpdateMessages, {
          viewerRole,
          events: [
            update,
            { ...update, _id: "second", toValue: "resolved", message: "Repair completed." },
          ],
        }),
      );
      expect(html).toContain("Update messages");
      expect(html).toContain(update.message);
      expect(html).toContain("Test Staff");
      expect(html).toContain("In Progress");
      expect(html.indexOf("Repair completed.")).toBeLessThan(html.indexOf(update.message));
    },
  );

  it("omits empty messages and unrelated timeline entries", () => {
    const html = renderToStaticMarkup(
      createElement(ComplaintUpdateMessages, {
        events: [
          { ...update, message: "  " },
          { ...update, eventType: "note_added", message: "Internal note added" },
        ],
      }),
    );
    expect(html).toBe("");
  });
});
