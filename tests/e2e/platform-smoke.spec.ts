import { expect, test } from "@playwright/test";

import { expectNoHorizontalOverflow, expectNoSeriousAccessibilityViolations, signIn } from "./helpers";

test("educator navigation and review decision editing work", async ({ page }, testInfo) => {
  await signIn(page);
  await expect(page.getByRole("heading", { name: "Assigned children", exact: true })).toBeVisible();
  await expect(page.getByText("Child 1001", { exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await expectNoSeriousAccessibilityViolations(page, testInfo);

  await page.getByRole("link", { name: "Continue review" }).click();
  await expect(page.getByRole("heading", { name: "Review AI draft" })).toBeVisible();
  await page.getByRole("button", { name: "What the AI noticed" }).first().click();
  await page.getByRole("button", { name: "Emerging" }).last().click();
  await expect(page.getByText("Unsaved changes", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Discard", exact: true }).click();
  await expect(page.getByText("Unsaved changes", { exact: true })).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
});

test("mobile review opens the full-screen decision editor", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await signIn(page);
  await page.getByRole("link", { name: "Continue review" }).click();
  await expect(page.getByRole("button", { name: "Open decision editor" })).toBeVisible();
  await page.getByRole("button", { name: "Open decision editor" }).click();
  await expect(page.getByRole("button", { name: "Back to items" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Save decision" })).toBeAttached();
  await expectNoHorizontalOverflow(page);
});

test("administrator can inspect access and jobs without overflow", async ({ page }, testInfo) => {
  await signIn(page, "Casey Rivera");
  await expect(page.getByRole("heading", { name: "Pilot access", exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await expectNoSeriousAccessibilityViolations(page, testInfo);
  await page.getByRole("link", { name: "Jobs" }).click();
  await expect(page.getByRole("heading", { name: "Processing jobs", exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});
