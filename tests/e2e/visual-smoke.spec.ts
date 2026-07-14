import { expect, test } from "@playwright/test";

import { signIn } from "./helpers";

test("@visual sign-in desktop", async ({ page }) => {
  await page.goto("/sign-in");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await expect(page).toHaveScreenshot("sign-in-desktop.png", { fullPage: true });
});

test("@visual assigned children desktop", async ({ page }) => {
  await signIn(page);
  await expect(page.getByText("Child 1001", { exact: true })).toBeVisible();
  await expect(page).toHaveScreenshot("assigned-children-desktop.png", { fullPage: true });
});

test("@visual assigned children mobile", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await signIn(page);
  await expect(page.getByText("Child 1001", { exact: true })).toBeVisible();
  await expect(page).toHaveScreenshot("assigned-children-mobile.png", { fullPage: true });
});
