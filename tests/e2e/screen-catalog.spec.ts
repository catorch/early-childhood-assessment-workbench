import { expect, test, type Page } from "@playwright/test";

import { expectNoHorizontalOverflow, expectNoSeriousAccessibilityViolations, resetScreenFixture, signIn } from "./helpers";
import { screenCatalog, type ScreenMode } from "./screen-catalog";

const observationVideo = "tests/fixtures/synthetic-observation.mp4";

async function interceptInitialState(page: Page, mode: ScreenMode) {
  if (mode === "children-error") {
    await page.route("**/api/children", (route) => route.fulfill({ status: 503, json: { error: "Unavailable" } }));
  }
  if (mode === "admin-access-empty") {
    await page.route("**/api/admin/access", (route) => route.fulfill({ status: 200, json: {
      staff: [], children: [], access: [], assignments: [], actorId: "user-admin-1"
    } }));
  }
  if (mode === "admin-access-error") {
    await page.route("**/api/admin/access", (route) => route.fulfill({ status: 503, json: { error: "Unavailable" } }));
  }
}

async function openScreen(page: Page, mode: ScreenMode) {
  await interceptInitialState(page, mode);
  if (mode === "sign-in") {
    await page.goto("/sign-in");
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    return;
  }
  if (mode === "auth-failure") {
    await page.route("**/api/session", (route) => route.request().method() === "POST"
      ? route.fulfill({ status: 401, json: { error: "Unable to sign in." } })
      : route.continue());
    await page.goto("/sign-in");
    await page.getByRole("button", { name: /Alex Morgan/ }).click();
    await expect(page.getByText("We could not confirm access.", { exact: false })).toBeVisible();
    return;
  }
  if (mode === "session-expired") {
    await page.goto("/session-expired?returnTo=%2Fchildren");
    await expect(page.getByRole("heading", { name: "Your session expired" })).toBeVisible();
    return;
  }
  if (mode === "unavailable") {
    await page.goto("/unavailable");
    await expect(page.getByRole("heading", { name: "This record is not available" })).toBeVisible();
    return;
  }

  const admin = mode.startsWith("admin-");
  await signIn(page, admin ? "Casey Rivera" : mode === "children-empty" ? "Jordan Lee" : "Alex Morgan");

  if (mode === "children" || mode === "children-empty" || mode === "children-error") return;
  if (mode === "child-detail") await page.goto("/children/child-1001");
  if (mode === "assessments") await page.goto("/assessments");
  if (["upload-progress", "upload-ready", "upload-validation", "upload-network"].includes(mode)) {
    await page.goto("/assessments/new?childId=child-1001&assessmentId=assessment-upload-ready");
    await expect(page.getByRole("heading", { name: "Upload observational video" })).toBeVisible();
  }
  if (mode === "permission-blocked") await page.goto("/assessments/new?childId=child-1048");
  if (mode === "processing") await page.goto("/assessments/assessment-processing/processing");
  if (mode === "processing-failed") await page.goto("/assessments/assessment-failed/processing");
  if (mode === "processing-ready") await page.goto("/assessments/assessment-ready/processing");
  if (["review", "review-save-failure", "review-video-unavailable", "review-conflict", "review-editor", "review-loading"].includes(mode)) {
    if (mode === "review-save-failure") {
      await page.route("**/api/assessments/assessment-ready/suggestions/**", (route) => route.fulfill({ status: 503, json: { error: "This decision was not saved." } }));
    }
    if (mode === "review-video-unavailable") {
      await page.route("**/api/assessments/assessment-ready/video?token=**", (route) => route.fulfill({ status: 404 }));
    }
    if (mode === "review-conflict") {
      await page.route("**/api/assessments/assessment-ready/suggestions/**", (route) => route.fulfill({ status: 409, json: {
        code: "REVISION_CONFLICT",
        error: "This item changed in another session.",
        currentDecision: {
          suggestionId: "run-ready-suggestion-3", educatorId: "user-educator-1", origin: "ACCEPTED",
          finalCredit: "PRESENT", dismissed: false, note: "Latest saved context.", revision: 1,
          decidedAt: "2026-07-14T14:00:00.000Z"
        },
        summary: null
      } }));
    }
    if (mode === "review-loading") {
      await page.route("**/api/assessments/assessment-ready/review", async () => {
        await new Promise(() => undefined);
      });
    }
    await page.goto("/assessments/assessment-ready/review");
  }
  if (mode === "review-no-results") await page.goto("/assessments/assessment-no-results/review");
  if (mode === "summary-complete") await page.goto("/assessments/assessment-complete/summary");
  if (mode === "summary-incomplete") await page.goto("/assessments/assessment-incomplete/summary");
  if (mode === "final") await page.goto("/assessments/assessment-final/final");
  if (mode === "admin-access") return;
  if (mode === "admin-access-empty" || mode === "admin-access-error") return;
  if (mode === "admin-deactivate") {
    await page.getByRole("button", { name: "Deactivate", exact: true }).first().click();
  }
  if (mode === "admin-unassign") {
    await page.getByRole("button", { name: "Remove", exact: true }).first().click();
  }
  if (mode === "admin-children") {
    await page.goto("/admin/children");
    await expect(page.getByRole("heading", { name: "Children", exact: true })).toBeVisible();
  }
  if (mode === "admin-catalog") {
    await page.goto("/admin/catalog");
    await expect(page.getByRole("heading", { name: "Skills catalogue", exact: true })).toBeVisible();
  }
  if (["admin-jobs", "admin-jobs-empty", "admin-jobs-error", "admin-retry"].includes(mode)) {
    if (mode === "admin-jobs-empty") {
      await page.route("**/api/admin/jobs?**", (route) => route.fulfill({ status: 200, json: {
        jobs: [], totalRelevant: 0, lastRefreshedAt: "2026-07-14T14:00:00.000Z"
      } }));
    }
    if (mode === "admin-jobs-error") {
      await page.route("**/api/admin/jobs?**", (route) => route.fulfill({ status: 503, json: { error: "Unavailable" } }));
    }
    await page.goto("/admin/jobs");
    if (mode === "admin-retry") await page.getByRole("button", { name: "Retry processing" }).click();
  }

  if (mode === "upload-progress" || mode === "upload-network") {
    await page.route("**/api/assessments/assessment-upload-ready/upload", async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      if (mode === "upload-network") return route.abort("connectionfailed");
      await new Promise(() => undefined);
    });
    await page.getByRole("button", { name: "Replace" }).click();
    await page.locator('input[type="file"]').setInputFiles(observationVideo);
    await page.getByRole("button", { name: "Upload video" }).click();
    await expect(page.getByText(mode === "upload-progress" ? "Uploading video" : "The network interrupted", { exact: false })).toBeVisible();
  }
  if (mode === "upload-validation") {
    await page.getByRole("button", { name: "Replace" }).click();
    await page.locator('input[type="file"]').setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("not video") });
    await expect(page.getByText("Choose an MP4, WebM, or MOV video.")).toBeVisible();
  }
  if (mode === "review-save-failure" || mode === "review-conflict") {
    await expect(page.getByRole("heading", { name: "Review AI suggestions" })).toBeVisible();
    await page.getByRole("button", { name: "Emerging" }).last().click();
    await page.getByRole("button", { name: "Save decision" }).click();
    await expect(page.getByText(mode === "review-conflict" ? "Review changed in another session" : "Decision needs attention")).toBeVisible();
  }
  if (mode === "review-video-unavailable") {
    await expect(page.getByText("Restore secure access to continue playback.", { exact: false })).toBeVisible();
  }
  if (mode === "review-editor") {
    await expect(page.getByRole("button", { name: "Edit / add note" }).first()).toBeVisible();
    await page.getByRole("button", { name: "Edit / add note" }).first().click();
  }
}

for (const fixture of screenCatalog) {
  test(`@visual screen-${fixture.id} ${fixture.name}`, async ({ page }, testInfo) => {
    await page.setViewportSize(fixture.viewport);
    await resetScreenFixture(page, fixture.id);
    await openScreen(page, fixture.mode);
    await expect(page.locator("main").first()).toBeVisible();
    if (fixture.mode !== "review-loading" && fixture.mode !== "upload-progress") {
      await page.waitForLoadState("networkidle", { timeout: 2_000 }).catch(() => undefined);
    }
    await expectNoHorizontalOverflow(page);
    await expectNoSeriousAccessibilityViolations(page, testInfo);
    await expect(page).toHaveScreenshot(`screen-${fixture.id}.png`, { fullPage: true });
  });
}
