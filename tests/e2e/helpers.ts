import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, type TestInfo } from "@playwright/test";

export async function signIn(page: Page, profile: "Alex Morgan" | "Jordan Lee" | "Casey Rivera" = "Alex Morgan") {
  await page.goto("/sign-in");
  await page.getByRole("button", { name: new RegExp(profile) }).click();
  await page.waitForURL(profile === "Casey Rivera" ? "**/admin/access" : "**/children");
}

export async function resetScreenFixture(
  page: Page,
  screenId: string,
  stress?: "long-skill" | "dense-results" | "long-email" | "localized-label" | "manual-add"
) {
  const response = await page.request.post("/api/internal/test-fixtures", {
    headers: { "x-help-review-fixture-key": "playwright" },
    data: { screenId, ...(stress ? { stress } : {}) }
  });
  expect(response.ok(), await response.text()).toBe(true);
}

export async function expectNoHorizontalOverflow(page: Page) {
  const widths = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth
  }));
  expect(widths.document).toBeLessThanOrEqual(widths.viewport);
}

export async function expectNoSeriousAccessibilityViolations(page: Page, testInfo: TestInfo) {
  const result = await new AxeBuilder({ page }).analyze();
  const violations = result.violations.filter((violation) => violation.impact === "serious" || violation.impact === "critical");
  await testInfo.attach("axe-results", {
    body: JSON.stringify(result.violations, null, 2),
    contentType: "application/json"
  });
  expect(violations, violations.map((violation) => `${violation.id}: ${violation.help}`).join("\n")).toEqual([]);
}
