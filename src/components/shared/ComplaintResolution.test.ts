import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ComplaintResolution } from "./ComplaintResolution";

describe("ComplaintResolution", () => {
  it.each(["resolved", "closed"])("shows details for %s complaints", (status) => {
    const html = renderToStaticMarkup(
      createElement(ComplaintResolution, {
        status,
        summary: "Repaired the projector.\nTested with the student.",
        resolverName: "Test Staff",
      }),
    );
    expect(html).toContain("Resolution details");
    expect(html).toContain("Repaired the projector.\nTested with the student.");
    expect(html).toContain("Resolved by Test Staff");
  });
  it("labels retained details as a previous resolution when reopened", () => {
    const html = renderToStaticMarkup(
      createElement(ComplaintResolution, { status: "in_progress", summary: "Earlier repair." }),
    );
    expect(html).toContain("Previous resolution details");
    expect(html).toContain("Earlier repair.");
  });
  it("handles legacy resolved complaints without details", () => {
    expect(
      renderToStaticMarkup(createElement(ComplaintResolution, { status: "resolved" })),
    ).toContain("No resolution details recorded.");
  });
  it("hides the section before a complaint has ever been resolved", () => {
    expect(renderToStaticMarkup(createElement(ComplaintResolution, { status: "submitted" }))).toBe(
      "",
    );
  });
});
