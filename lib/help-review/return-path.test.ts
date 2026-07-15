import { describe, expect, it } from "vitest";

import { safeRelativeReturnPath } from "./return-path";

describe("safeRelativeReturnPath", () => {
  it("preserves an application-local path with a safe query", () => {
    expect(safeRelativeReturnPath("/assessments/a/review?skill=s-1", "/children"))
      .toBe("/assessments/a/review?skill=s-1");
  });

  it("preserves only route-specific navigation parameters", () => {
    expect(safeRelativeReturnPath(
      "/assessments?filter=finalized&search=Child+1001&token=secret&note=private#payload",
      "/children"
    )).toBe("/assessments?filter=finalized&search=Child+1001");
    expect(safeRelativeReturnPath(
      "/assessments/a/review?skill=s-1&token=secret&skill=duplicate",
      "/children"
    )).toBe("/assessments/a/review");
  });

  it.each(["/api/session", "/sign-in?returnTo=/admin/access", "/unknown", "/assessments/a/edit"])(
    "rejects a non-resumable application route %s",
    (target) => expect(safeRelativeReturnPath(target, "/children")).toBe("/children")
  );

  it.each(["https://evil.test", "//evil.test/path", "/\\evil.test", "/path\nnext", "javascript:alert(1)"])(
    "rejects unsafe return target %s",
    (target) => expect(safeRelativeReturnPath(target, "/children")).toBe("/children")
  );
});
