import { describe, expect, it } from "vitest";

import { isDeliverableSupportEmail, supportContactHref } from "./support-contact";

describe("support contact", () => {
  it("uses a configured deliverable address", () => {
    expect(isDeliverableSupportEmail("support@help-review.dev")).toBe(true);
    expect(supportContactHref("support@help-review.dev")).toBe(
      "mailto:support@help-review.dev?subject=HELP%20Review%20pilot%20support"
    );
  });

  it("never ships a reserved placeholder recipient", () => {
    expect(isDeliverableSupportEmail("pilot-support@example.test")).toBe(false);
    expect(supportContactHref("pilot-support@example.test")).toBeNull();
    expect(supportContactHref(undefined)).toBeNull();
  });
});
