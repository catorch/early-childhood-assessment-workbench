import { expect, test, type Page, type TestInfo } from "@playwright/test";

import {
  expectNoHorizontalOverflow,
  expectNoSeriousAccessibilityViolations,
  resetScreenFixture,
  signIn
} from "./helpers";

async function audit(page: Page, testInfo: TestInfo) {
  await expect(page.locator("main").first()).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await expectNoSeriousAccessibilityViolations(page, testInfo);
}

async function auditAtTwoHundredPercent(page: Page, testInfo: TestInfo) {
  // A 640 CSS-pixel viewport is the reflow equivalent of a 1280 px window at 200% browser zoom.
  await page.setViewportSize({ width: 640, height: 800 });
  await audit(page, testInfo);
}

test("@a11y sign-in reflows on mobile and at 200 percent", async ({ page }, testInfo) => {
  await resetScreenFixture(page, "01");
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/sign-in");
  await audit(page, testInfo);
  await expect(page.getByRole("button", { name: /Alex Morgan/ })).toHaveCSS("min-height", "62px");

  await page.reload();
  await auditAtTwoHundredPercent(page, testInfo);
});

test("@a11y child navigation and intake remain keyboard reachable and reflow", async ({ page }, testInfo) => {
  await resetScreenFixture(page, "02");
  await page.setViewportSize({ width: 360, height: 800 });
  await signIn(page);
  await audit(page, testInfo);

  const action = page.getByRole("link", { name: "Continue review" }).first();
  await action.focus();
  await expect(action).toBeFocused();

  await page.goto("/assessments/new?childId=child-1001&assessmentId=assessment-upload-ready");
  await audit(page, testInfo);
  await expect(page.getByRole("button", { name: "Start processing" })).toBeVisible();

  await page.reload();
  await auditAtTwoHundredPercent(page, testInfo);
});

test("@a11y processing states expose a stable status without horizontal overflow", async ({ page }, testInfo) => {
  await resetScreenFixture(page, "04");
  await signIn(page);
  await page.goto("/assessments/assessment-processing/processing");
  await audit(page, testInfo);
  await expect(page.getByRole("heading", { name: "Analyzing observation" })).toBeVisible();

  await page.setViewportSize({ width: 360, height: 800 });
  await page.reload();
  await audit(page, testInfo);
});

test("@a11y review works across desktop, tablet, mobile editor, and zoom", async ({ page }, testInfo) => {
  await resetScreenFixture(page, "05");
  await signIn(page);
  await page.goto("/assessments/assessment-ready/review");
  await audit(page, testInfo);
  await expect(page.locator("video")).toHaveAttribute("controls", "");

  await page.setViewportSize({ width: 768, height: 1024 });
  await page.reload();
  await audit(page, testInfo);

  await page.setViewportSize({ width: 360, height: 800 });
  await page.reload();
  const openEditor = page.getByRole("button", { name: "Edit / add note" }).first();
  await openEditor.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Back to items" })).toBeVisible();
  await audit(page, testInfo);

  await page.reload();
  await auditAtTwoHundredPercent(page, testInfo);
});

test("@a11y summary and final records preserve headings, labels, and reflow", async ({ page }, testInfo) => {
  await resetScreenFixture(page, "06");
  await signIn(page);
  await page.goto("/assessments/assessment-complete/summary");
  await audit(page, testInfo);
  await expect(page.getByRole("heading", { name: "Review assessment summary" })).toBeVisible();

  const finalize = page.getByRole("button", { name: "Confirm final assessment" });
  await finalize.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(finalize).toBeFocused();

  await page.goto("/assessments/assessment-final/final");
  await audit(page, testInfo);
  await expect(page.getByRole("heading", { name: "Assessment finalized" })).toBeVisible();

  await page.setViewportSize({ width: 360, height: 800 });
  await page.reload();
  await audit(page, testInfo);
  await page.reload();
  await auditAtTwoHundredPercent(page, testInfo);
});

test("@a11y Admin dialogs contain focus and restore it to their trigger", async ({ page }, testInfo) => {
  await resetScreenFixture(page, "08");
  await signIn(page, "Casey Rivera");
  await audit(page, testInfo);

  const deactivate = page.getByRole("button", { name: "Deactivate", exact: true }).first();
  await deactivate.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Cancel" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(deactivate).toBeFocused();

  await page.goto("/admin/jobs");
  await audit(page, testInfo);
  await page.setViewportSize({ width: 360, height: 800 });
  await page.reload();
  await audit(page, testInfo);
});
