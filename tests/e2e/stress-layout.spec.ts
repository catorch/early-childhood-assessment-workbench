import { expect, test } from "@playwright/test";

import { expectNoHorizontalOverflow, resetScreenFixture, signIn } from "./helpers";

test("@visual @stress long skill content wraps inside the review workspace", async ({ page }) => {
  await resetScreenFixture(page, "05", "long-skill");
  await signIn(page);
  await page.goto("/assessments/assessment-ready/review");
  await expect(page.getByRole("heading", { name: "Review AI draft" })).toBeVisible();
  await expect(page.getByText("Coordinates several small objects", { exact: false }).first()).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await expect(page).toHaveScreenshot("stress-long-skill.png", { fullPage: true });
});

test("@visual @stress dense results retain stable navigation and readable rows", async ({ page }) => {
  await resetScreenFixture(page, "05", "dense-results");
  await signIn(page);
  await page.goto("/assessments/assessment-ready/review");
  await expect(page.getByText("of 32 actioned", { exact: false })).toBeVisible();
  await expect(page.locator('section[aria-label="AI skill suggestions"] article')).toHaveCount(32);
  await expectNoHorizontalOverflow(page);
  await expect(page).toHaveScreenshot("stress-dense-results.png", { fullPage: true });
});

test("@visual @stress long staff identity stays inside Admin surfaces", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await resetScreenFixture(page, "08", "long-email");
  await signIn(page, "Casey Rivera");
  await expect(page.getByText("alexandria.montgomery-rivera", { exact: false }).first()).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await expect(page).toHaveScreenshot("stress-long-email.png", { fullPage: true });
});

test("@visual @stress localized labels wrap on mobile child navigation", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await resetScreenFixture(page, "34", "localized-label");
  await signIn(page);
  await expect(page.getByText("Participante infantil del programa 1001", { exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await expect(page).toHaveScreenshot("stress-localized-label.png", { fullPage: true });
});
