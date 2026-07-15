import { expect, test, type Page, type Route } from "@playwright/test";

import { resetScreenFixture, signIn } from "./helpers";

const observationVideo = "tests/fixtures/synthetic-observation.mp4";

async function fulfillOnceThenContinue(
  page: Page,
  url: string,
  firstResponse: Parameters<Route["fulfill"]>[0]
) {
  let first = true;
  await page.route(url, async (route) => {
    if (!first) return route.continue();
    first = false;
    await route.fulfill(firstResponse);
  });
}

test("AUTH-001: root entry resolves by authentication and role", async ({ page }) => {
  await resetScreenFixture(page, "02");
  await page.goto("/");
  await expect(page).toHaveURL(/\/sign-in$/);

  await signIn(page);
  await page.goto("/");
  await expect(page).toHaveURL(/\/children$/);

  await page.request.delete("/api/session");
  await signIn(page, "Casey Rivera");
  await page.goto("/");
  await expect(page).toHaveURL(/\/admin\/access$/);
});

test("LIVE-001: managed sign-in verifies with Google before creating an application session", async ({ page }) => {
  let providerSignInAttempts = 0;
  let releaseIdentityConfiguration!: () => void;
  const identityConfigurationGate = new Promise<void>((resolve) => {
    releaseIdentityConfiguration = resolve;
  });
  await page.route(/\/api\/session\/config$/, async (route) => {
    await identityConfigurationGate;
    await route.fulfill({
      status: 200,
      json: { mode: "identity-platform", apiKey: "restricted-test-key" }
    });
  });
  await page.route(/identitytoolkit\.googleapis\.com/, async (route) => {
    const headers = {
      "Access-Control-Allow-Headers": "content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Origin": "*"
    };
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers });
      return;
    }
    if (route.request().url().includes("sendOobCode")) {
      await route.fulfill({ status: 400, headers, json: { error: { message: "EMAIL_NOT_FOUND" } } });
      return;
    }
    providerSignInAttempts += 1;
    if (providerSignInAttempts === 1) {
      await route.fulfill({ status: 400, headers, json: { error: { message: "INVALID_LOGIN_CREDENTIALS" } } });
      return;
    }
    await route.fulfill({
      status: 200,
      headers,
      json: { idToken: "verified-provider-token-".padEnd(140, "x") }
    });
  });
  let applicationSessionPayload: unknown;
  await page.route(/\/api\/session$/, async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    applicationSessionPayload = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      json: { user: { id: "managed-educator", displayName: "Managed Educator", role: "EDUCATOR" }, sandbox: false }
    });
  });

  await page.goto("/sign-in");
  await expect(page.getByText("Confirming your approved sign-in method.")).toBeVisible();
  await expect(page.getByText("Choose an approved sanitized staff profile.")).toHaveCount(0);
  releaseIdentityConfiguration();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByText("Use your provisioned staff account.")).toBeVisible();
  await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Alex Morgan" })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(page.getByLabel("Email")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await page.getByLabel("Email").fill("managed.educator@example.test");
  await page.getByRole("button", { name: "Reset password" }).click();
  await expect(page.getByText("If this address has an account, a reset email is on its way.")).toBeVisible();

  await page.getByLabel("Password", { exact: true }).fill("provider-owned-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "We could not confirm access" })).toBeFocused();
  await expect(page.getByLabel("Email")).toHaveValue("managed.educator@example.test");
  await expect(page.getByLabel("Password", { exact: true })).toHaveValue("");

  await page.getByLabel("Password", { exact: true }).fill("provider-owned-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect.poll(() => applicationSessionPayload).toEqual({
    idToken: "verified-provider-token-".padEnd(140, "x")
  });
});

test("SHELL-002 and SHELL-004: current navigation is announced and the sandbox boundary persists", async ({ page }) => {
  await resetScreenFixture(page, "02");
  await signIn(page);
  const banner = page.getByText("Sanitized pilot sandbox. Real child data is disabled.");
  await expect(banner).toBeVisible();
  await expect(page.getByRole("link", { name: "Children", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("link", { name: "Assessments", exact: true })).not.toHaveAttribute("aria-current", "page");

  await page.getByRole("link", { name: "Assessments", exact: true }).click();
  await expect(page).toHaveURL(/\/assessments$/);
  await expect(banner).toBeVisible();
  await expect(page.getByRole("link", { name: "Assessments", exact: true })).toHaveAttribute("aria-current", "page");
});

test("AUTH-006 and SHELL-003: support is actionable and sign-out clears the session", async ({ page }) => {
  await resetScreenFixture(page, "02");
  await signIn(page);

  const support = page.getByRole("link", { name: "Contact pilot support" });
  await expect(support).toHaveAttribute("href", /^mailto:[^?@]+@[^?@]+\?/);
  await expect(support).toHaveAttribute("href", /subject=HELP(?:%20|\+)Review(?:%20|\+)pilot(?:%20|\+)support/);
  await expect(support).not.toHaveAttribute("href", /example\.(test|com|org|net)/);

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  const session = await page.request.get("/api/session");
  expect(session.status()).toBe(401);
});

test("CHILD-003 and CHILD-004: assigned-child search filters locally and explains no matches", async ({ page }) => {
  await resetScreenFixture(page, "02");
  await signIn(page);

  const search = page.getByRole("searchbox", { name: "Search assigned children" });
  await search.fill("1001");
  await expect(page.getByText("Child 1001", { exact: true })).toBeVisible();
  await expect(page.getByText("Child 1024", { exact: true })).toHaveCount(0);

  await search.fill("missing-child");
  await expect(page.getByRole("heading", { name: "No matching children" })).toBeVisible();
  await expect(page.getByText("Try a different child identifier.")).toBeVisible();

  await search.fill("");
  await expect(page.getByText("Child 1001", { exact: true })).toBeVisible();
  await expect(page.getByText("Child 1024", { exact: true })).toBeVisible();
});

test("CHILD-009: a failed child detail load can be retried without stale content", async ({ page }) => {
  await resetScreenFixture(page, "14");
  await signIn(page);
  await fulfillOnceThenContinue(page, "**/api/children/child-1001", {
    status: 503,
    json: { error: "Unavailable" }
  });

  await page.goto("/children/child-1001");
  await expect(page.getByRole("heading", { name: "Child record could not be loaded" })).toBeVisible();
  await expect(page.getByText("Child 1001", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByRole("heading", { name: "Child 1001" })).toBeVisible();
});

test("CHILD-002 and CHILD-006: child loading and recovery never expose stale assignments", async ({ page }) => {
  await resetScreenFixture(page, "02");
  await signIn(page);
  let releaseLoading: (() => void) | undefined;
  await page.route("**/api/children", async () => {
    await new Promise<void>((resolve) => { releaseLoading = resolve; });
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Loading assigned children" })).toBeVisible();
  await expect(page.getByText("Child 1001", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Continue review" })).toHaveCount(0);
  releaseLoading?.();
  await page.unroute("**/api/children");

  await fulfillOnceThenContinue(page, "**/api/children", {
    status: 503,
    json: { error: "Unavailable" }
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Children could not be loaded" })).toBeVisible();
  await expect(page.getByText("Child 1001", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Sign out" }).last()).toBeVisible();
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByText("Child 1001", { exact: true })).toBeVisible();
});

test("ASSESS-004: assessment failures and empty results remain distinct and recoverable", async ({ page }) => {
  await resetScreenFixture(page, "16");
  await signIn(page);
  await fulfillOnceThenContinue(page, "**/api/assessments?**", {
    status: 503,
    json: { error: "Unavailable" }
  });

  await page.goto("/assessments");
  await expect(page.getByRole("heading", { name: "Assessments could not be loaded" })).toBeVisible();
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByRole("region", { name: "Assessments" })).toBeVisible();

  await page.route("**/api/assessments?**", (route) => route.fulfill({
    status: 200,
    json: { assessments: [] }
  }));
  await page.getByRole("button", { name: "Finalized" }).click();
  await expect(page.getByRole("heading", { name: "No matching assessments" })).toBeVisible();
  await expect(page.getByRole("link", { name: "View assigned children" })).toBeVisible();
});

test("ASSESS-002 and ASSESS-003: assessment filters and search round-trip through the URL", async ({ page }) => {
  await resetScreenFixture(page, "16");
  await signIn(page);
  await page.goto("/assessments");

  await page.getByRole("button", { name: "finalized" }).click();
  await expect(page).toHaveURL(/filter=finalized/);
  await expect(page.getByRole("button", { name: "finalized" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("Finalized", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "all" }).click();
  await expect(page.getByRole("button", { name: "all" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("searchbox", { name: "Search assessments" }).fill("1024");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page).toHaveURL(/filter=all&search=1024/);
  const assessments = page.getByRole("region", { name: "Assessments" });
  await expect(assessments.getByText("Child 1024", { exact: true })).toHaveCount(3);
  await expect(assessments.getByText("Child 1001", { exact: true })).toHaveCount(0);

  await page.getByRole("searchbox", { name: "Search assessments" }).fill("");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page).toHaveURL(/filter=all$/);
  await expect(assessments.getByText("Child 1001", { exact: true }).first()).toBeVisible();
});

test("ASSESS-006: an invalid observation date is rejected and a persisted draft locks the date", async ({ page }) => {
  await resetScreenFixture(page, "17");
  await signIn(page);
  await page.goto("/assessments/new?childId=child-1001");

  const date = page.getByLabel("Observation date");
  await expect(date).toBeEnabled();
  await date.fill("");
  await page.getByRole("button", { name: "Choose a video" }).click();
  await page.locator('input[type="file"]').setInputFiles(observationVideo);
  await page.getByRole("button", { name: "Upload video" }).click();
  await expect(page.getByText("Choose a valid observation date.")).toBeVisible();

  await page.goto("/assessments/new?childId=child-1001&assessmentId=assessment-upload-ready");
  await expect(page.getByLabel("Observation date")).toBeDisabled();
});

test("UPLOAD-003 and UPLOAD-004: file choice is inspectable discardable and rejects invalid local files", async ({ page }) => {
  await resetScreenFixture(page, "17");
  await signIn(page);
  await page.goto("/assessments/new?childId=child-1001&assessmentId=assessment-upload-ready");
  await page.getByRole("button", { name: "Replace" }).click();
  const input = page.locator('input[type="file"]');
  await expect(input).toHaveAttribute("accept", "video/mp4,video/webm,video/quicktime");

  await input.setInputFiles(observationVideo);
  await expect(page.getByText("synthetic-observation.mp4", { exact: true })).toBeVisible();
  await expect(page.getByText("ready to upload", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "Choose another" })).toBeVisible();
  await page.getByRole("button", { name: "Discard selected file" }).click();
  await expect(page.getByRole("button", { name: "Replace" })).toBeVisible();

  await page.getByRole("button", { name: "Replace" }).click();
  await input.setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("not a video") });
  await expect(page.getByText("Choose an MP4, WebM, or MOV video.")).toBeVisible();
  await input.setInputFiles({ name: "empty.mp4", mimeType: "video/mp4", buffer: Buffer.alloc(0) });
  await expect(page.getByText("larger than 0 bytes", { exact: false })).toBeVisible();
});

test("UPLOAD-009: replacing a selection preserves the verified video until the replacement uploads", async ({ page }) => {
  await resetScreenFixture(page, "17");
  await signIn(page);
  await page.goto("/assessments/new?childId=child-1001&assessmentId=assessment-upload-ready");

  const originalName = await page.locator("h3").filter({ hasText: /\S/ }).first().textContent();
  expect(originalName).toBeTruthy();
  await page.getByRole("button", { name: "Replace" }).click();
  await page.locator('input[type="file"]').setInputFiles(observationVideo);
  await expect(page.getByText("synthetic-observation.mp4", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Start processing" })).toBeDisabled();

  await page.getByRole("button", { name: "Discard selected file" }).click();
  await expect(page.getByText(originalName!, { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Start processing" })).toBeEnabled();
});

test("UPLOAD-012: save and exit preserves the verified draft for later return", async ({ page }) => {
  await resetScreenFixture(page, "17");
  await signIn(page);
  await page.goto("/assessments/new?childId=child-1001&assessmentId=assessment-upload-ready");
  const uploadedName = await page.locator("h3").filter({ hasText: /\S/ }).first().textContent();

  await page.getByRole("link", { name: "Save and exit" }).click();
  await expect(page).toHaveURL(/\/children\/child-1001$/);
  await expect(page.getByRole("heading", { name: "Child 1001" })).toBeVisible();

  await page.goto("/assessments/new?childId=child-1001&assessmentId=assessment-upload-ready");
  await expect(page.getByText(uploadedName!, { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Start processing" })).toBeEnabled();
});

test("UPLOAD-011 and UPLOAD-013: removing a video disables processing and a verified video can start it", async ({ page }) => {
  await resetScreenFixture(page, "17");
  await signIn(page);
  await page.goto("/assessments/new?childId=child-1001&assessmentId=assessment-upload-ready");
  await expect(page.getByRole("button", { name: "Start processing" })).toBeEnabled();
  await page.getByRole("button", { name: "Remove uploaded video" }).click();
  await expect(page.getByRole("button", { name: "Choose a video" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Start processing" })).toBeDisabled();

  await resetScreenFixture(page, "17");
  await page.reload();
  await expect(page.getByRole("button", { name: "Start processing" })).toBeEnabled();
  await page.getByRole("button", { name: "Start processing" }).click();
  await expect(page).toHaveURL(/\/assessments\/assessment-upload-ready\/processing$/);
  await expect(page.getByRole("heading", { name: /Analyzing observation|Ready for review/ })).toBeVisible();
});

test("PROCESS-002 and PROCESS-003: processing refreshes automatically and on demand", async ({ page }) => {
  await resetScreenFixture(page, "04");
  await signIn(page);
  let statusRequests = 0;
  await page.route("**/api/assessments/assessment-processing/status", async (route) => {
    statusRequests += 1;
    await route.continue();
  });

  await page.goto("/assessments/assessment-processing/processing");
  await expect(page.getByRole("heading", { name: "Analyzing observation" })).toBeVisible();
  await expect.poll(() => statusRequests, { timeout: 4_000 }).toBeGreaterThanOrEqual(2);

  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
  });
  const whileHidden = statusRequests;
  await page.waitForTimeout(1_800);
  expect(statusRequests).toBe(whileHidden);

  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
  });
  await expect.poll(() => statusRequests, { timeout: 3_000 }).toBeGreaterThan(whileHidden);

  const beforeManualRefresh = statusRequests;
  await page.getByRole("button", { name: "Refresh status" }).click();
  await expect.poll(() => statusRequests).toBeGreaterThan(beforeManualRefresh);
});

test("PROCESS-007: eligible retry creates a new current attempt without false success", async ({ page }) => {
  await resetScreenFixture(page, "21");
  await signIn(page);
  await page.goto("/assessments/assessment-failed/processing");
  await expect(page.getByRole("button", { name: "Retry processing" })).toBeEnabled();
  await page.getByRole("button", { name: "Retry processing" }).click();
  await expect(page.getByRole("heading", { name: "Analyzing observation" })).toBeVisible();
  await expect(page.getByText("Attempt 2", { exact: false })).toBeVisible();
});

test("REVIEW-003: review load failure offers an honest retry and restores the workspace", async ({ page }) => {
  await resetScreenFixture(page, "05");
  await signIn(page);
  await fulfillOnceThenContinue(page, "**/api/assessments/assessment-ready/review", {
    status: 503,
    json: { error: "Unavailable" }
  });

  await page.goto("/assessments/assessment-ready/review");
  await expect(page.getByRole("heading", { name: "Review could not be loaded" })).toBeVisible();
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByRole("heading", { name: "Review AI draft" })).toBeVisible();
});

test("REVIEW-017: unsaved review edits block internal navigation until resolved", async ({ page }) => {
  await resetScreenFixture(page, "05");
  await signIn(page);
  await page.goto("/assessments/assessment-ready/review");
  await page.getByLabel("Educator note optional").fill("Context that has not been saved yet.");
  await expect(page.getByText("Unsaved changes", { exact: true })).toBeVisible();

  await page.getByRole("link", { name: "Assessments", exact: true }).click();
  await expect(page).toHaveURL(/\/assessments\/assessment-ready\/review$/);
  await expect(page.getByText("Save or discard", { exact: false })).toBeVisible();

  await page.getByRole("button", { name: "Discard", exact: true }).click();
  await page.getByRole("link", { name: "Assessments", exact: true }).click();
  await expect(page).toHaveURL(/\/assessments$/);
});

test("REVIEW-004: review routes resolve not-ready and finalized records to current state", async ({ page }) => {
  await resetScreenFixture(page, "05");
  await signIn(page);

  await page.goto("/assessments/assessment-processing/review");
  await expect(page).toHaveURL(/\/assessments\/assessment-processing\/processing$/);
  await expect(page.getByRole("heading", { name: "Analyzing observation" })).toBeVisible();

  await page.goto("/assessments/assessment-final/review");
  await expect(page).toHaveURL(/\/assessments\/assessment-final\/final$/);
  await expect(page.getByRole("heading", { name: "Assessment finalized" })).toBeVisible();
});

test("REVIEW-006 and REVIEW-008: suggestions remain grouped and evidence disclosures are stateful", async ({ page }) => {
  await resetScreenFixture(page, "05");
  await signIn(page);
  await page.goto("/assessments/assessment-ready/review");

  const suggestions = page.getByRole("region", { name: "AI skill suggestions" });
  for (const label of ["Needs your review", "Present", "Emerging", "Not observed", "Not applicable"]) {
    await expect(suggestions.locator(`xpath=./section/header//strong[normalize-space()="${label}"]`)).toBeVisible();
  }
  await expect(suggestions.locator("article")).toHaveCount(8);

  const disclosure = suggestions.getByRole("button", { name: "What the AI noticed" }).first();
  await expect(disclosure).toHaveAttribute("aria-expanded", "false");
  await disclosure.click();
  await expect(disclosure).toHaveAttribute("aria-expanded", "true");
  await expect(disclosure.locator("xpath=following-sibling::div")).toBeVisible();
});

test("REVIEW-016 REVIEW-021 and REVIEW-022: notes persist progress is server-derived and clean finish opens summary", async ({ page }) => {
  await resetScreenFixture(page, "05");
  await signIn(page);
  await page.goto("/assessments/assessment-ready/review");
  const editor = page.locator("#review-editor");
  await expect(page.getByText("0 of 8 actioned", { exact: false })).toBeVisible();

  await editor.getByLabel("Educator note optional").fill("Observed after the second prompt.");
  await editor.getByRole("button", { name: /Emerging/ }).click();
  await editor.getByRole("button", { name: "Save decision" }).click();
  await expect(page.getByText("1 of 8 actioned", { exact: false })).toBeVisible();
  await expect(page.getByText("Unsaved changes", { exact: true })).toHaveCount(0);

  await page.reload();
  await expect(editor.getByLabel("Educator note optional")).toHaveValue("Observed after the second prompt.");
  await expect(page.getByText("1 of 8 actioned", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Finish & review" }).click();
  await expect(page).toHaveURL(/\/assessments\/assessment-ready\/summary$/);
  await expect(page.getByRole("heading", { name: "Review assessment summary" })).toBeVisible();
});

test("REVIEW-019: a failed save keeps edits and succeeds through the explicit retry", async ({ page }) => {
  await resetScreenFixture(page, "05");
  await signIn(page);
  let failSave = true;
  await page.route("**/api/assessments/assessment-ready/suggestions/**", (route) => failSave
    ? route.fulfill({ status: 503, json: { error: "This decision was not saved." } })
    : route.continue());
  await page.goto("/assessments/assessment-ready/review");
  const editor = page.locator("#review-editor");
  await editor.getByLabel("Educator note optional").fill("Keep this context through retry.");
  await editor.getByRole("button", { name: /Emerging/ }).click();
  await editor.getByRole("button", { name: "Save decision" }).click();
  await expect(editor.getByText("Decision needs attention")).toBeVisible();
  await expect(editor.getByLabel("Educator note optional")).toHaveValue("Keep this context through retry.");
  await expect(page.getByText("0 of 8 actioned", { exact: false })).toBeVisible();

  failSave = false;
  await editor.getByRole("button", { name: "Retry save" }).click();
  await expect(editor.getByText("Decision needs attention")).toHaveCount(0);
  await expect(page.getByText("1 of 8 actioned", { exact: false })).toBeVisible();
});

test("REVIEW-020: a revision conflict can adopt the authoritative decision", async ({ page }) => {
  await resetScreenFixture(page, "05");
  await signIn(page);
  await fulfillOnceThenContinue(page, "**/api/assessments/assessment-ready/suggestions/**", {
    status: 409,
    json: {
      code: "REVISION_CONFLICT",
      error: "This item changed in another session.",
      currentDecision: {
        suggestionId: "run-ready-suggestion-1",
        educatorId: "user-educator-1",
        origin: "SCORED_INDEPENDENTLY",
        finalCredit: "PRESENT",
        dismissed: false,
        note: "Latest saved context.",
        revision: 1,
        decidedAt: "2026-07-14T14:00:00.000Z"
      },
      summary: null
    }
  });
  await page.goto("/assessments/assessment-ready/review");
  const editor = page.locator("#review-editor");
  await editor.getByLabel("Educator note optional").fill("My competing context.");
  await editor.getByRole("button", { name: /Emerging/ }).click();
  await editor.getByRole("button", { name: "Save decision" }).click();

  const conflict = page.getByRole("alertdialog");
  await expect(conflict).toContainText("My competing context.");
  await expect(conflict).toContainText("Latest saved context.");
  await conflict.getByRole("button", { name: "Use latest decision" }).click();
  await expect(editor.getByLabel("Educator note optional")).toHaveValue("Latest saved context.");
  await expect(editor.getByRole("button", { name: /Present/ })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("Unsaved changes", { exact: true })).toHaveCount(0);
});

test("REVIEW-011: restoring video access preserves unsaved review context", async ({ page }) => {
  await resetScreenFixture(page, "24");
  await signIn(page);
  let videoFailures = 0;
  await page.route("**/api/assessments/assessment-ready/video?token=**", (route) => {
    if (videoFailures === 0) {
      videoFailures += 1;
      return route.fulfill({ status: 404 });
    }
    return route.continue();
  });
  await page.goto("/assessments/assessment-ready/review");
  const editor = page.locator("#review-editor");
  await editor.getByLabel("Educator note optional").fill("Do not lose this note.");
  await expect(page.getByText("Video access unavailable")).toBeVisible();
  await page.getByRole("button", { name: "Restore video access" }).click();
  await expect(page.locator("video").first()).toBeVisible();
  await expect(editor.getByLabel("Educator note optional")).toHaveValue("Do not lose this note.");
  await expect(page.getByText("Unsaved changes", { exact: true })).toBeVisible();
});

test("SUMMARY-005 and SUMMARY-006: final items stay reconciled and finalization is deliberate", async ({ page }) => {
  await resetScreenFixture(page, "06");
  await signIn(page);
  const reviewResponse = await page.request.get("/api/assessments/assessment-complete/review");
  expect(reviewResponse.ok()).toBe(true);
  const review = await reviewResponse.json() as {
    suggestions: Array<{ id: string }>;
    decisions: Array<{ suggestionId: string; revision: number }>;
  };
  const dismissedSuggestion = review.suggestions[0];
  const currentDecision = review.decisions.find((decision) => decision.suggestionId === dismissedSuggestion.id);
  const dismissResponse = await page.request.patch(
    `/api/assessments/assessment-complete/suggestions/${dismissedSuggestion.id}`,
    { data: { expectedRevision: currentDecision?.revision ?? 0, finalCredit: null, dismissed: true, note: "Outside this observation context." } }
  );
  expect(dismissResponse.ok()).toBe(true);
  await page.goto("/assessments/assessment-complete/summary");

  const finalSkills = page.getByRole("region", { name: "Final skills" });
  await expect(finalSkills.locator("article")).toHaveCount(7);
  await expect(finalSkills.getByText(/Accepted draft|Overridden|Scored independently/).first()).toBeVisible();
  const dismissed = page.getByRole("region", { name: "Dismissed suggestions" });
  await expect(dismissed.locator("article")).toHaveCount(1);

  const trigger = page.getByRole("button", { name: "Confirm final assessment" });
  await trigger.click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toContainText("7 included skills");
  await expect(dialog).toContainText("1 dismissed suggestion");
  await expect(dialog).toContainText("decisions will be locked");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("ADMIN-ACCESS-004 and ADMIN-ACCESS-011: access filters are URL-backed and failed confirmation remains recoverable", async ({ page }) => {
  await resetScreenFixture(page, "08");
  await signIn(page, "Casey Rivera");
  await expect(page.getByRole("heading", { name: "Alex Morgan" })).toBeVisible();
  await expect(page.getByText("alex.educator@example.test", { exact: true })).toBeVisible();
  await expect(page.getByText("Pilot access active", { exact: true })).toBeVisible();
  await expect(page.getByText("3 active", { exact: true })).toBeVisible();

  const provisionTrigger = page.getByRole("button", { name: "Provision staff" });
  await provisionTrigger.press("Enter");
  await expect(provisionTrigger).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByLabel("Display name")).toBeFocused();
  await page.getByRole("button", { name: "Cancel", exact: true }).press("Enter");
  await expect(provisionTrigger).toHaveAttribute("aria-expanded", "false");
  await expect(provisionTrigger).toBeFocused();

  await page.getByRole("searchbox", { name: "Search staff" }).fill("Alex Morgan");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page).toHaveURL(/search=Alex(?:\+|%20)Morgan/);
  await expect(page.getByRole("button", { name: /Alex Morgan/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Jordan Lee/ })).toHaveCount(0);

  await page.route("**/api/admin/access", (route) => route.request().method() === "POST"
    ? route.fulfill({ status: 503, json: { error: "Access service unavailable." } })
    : route.continue());
  await page.getByRole("button", { name: "Deactivate", exact: true }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Deactivate access" }).click();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("alert")).toContainText("Access service unavailable");
  await expect(dialog.getByRole("button", { name: "Deactivate access" })).toBeEnabled();
});

test("ADMIN-JOBS-003 ADMIN-JOBS-005 and ADMIN-JOBS-007: job filters details and retry confirmation stay safe", async ({ page }) => {
  await resetScreenFixture(page, "09");
  await signIn(page, "Casey Rivera");
  await page.goto("/admin/jobs");

  const jobs = page.getByRole("region", { name: "Failed processing jobs" });
  await expect(jobs.getByRole("button")).toHaveCount(2);
  await page.getByRole("button", { name: "Stuck", exact: true }).click();
  await expect(page).toHaveURL(/filter=stuck/);
  await expect(jobs.getByRole("button")).toHaveCount(1);
  await expect(jobs).toContainText("Stuck");

  await page.getByRole("button", { name: "All", exact: true }).click();
  await expect(page.getByRole("button", { name: "All", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page).toHaveURL(/\/admin\/jobs$/);
  await page.getByRole("searchbox", { name: "Search jobs" }).fill("Child 1001");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page).toHaveURL(/search=Child(?:\+|%20)1001/);
  await expect(jobs.getByRole("button")).toHaveCount(1);
  const details = page.getByRole("complementary");
  await expect(details.getByRole("heading", { level: 2 })).toBeVisible();
  await expect(page.getByText("Attempt 1", { exact: false })).toBeVisible();
  await expect(page.getByText("Available", { exact: true })).toBeVisible();
  const selectedJobRow = jobs.getByRole("button").first();
  await expect(selectedJobRow).toHaveAttribute("aria-expanded", "true");
  await details.getByRole("button", { name: "Close job details" }).press("Enter");
  await expect(details).toHaveCount(0);
  await expect(selectedJobRow).toHaveAttribute("aria-expanded", "false");
  await expect(selectedJobRow).toBeFocused();
  await selectedJobRow.press("Enter");
  await expect(page.getByRole("complementary")).toBeVisible();

  let retries = 0;
  await page.route("**/api/admin/jobs/**/retry", (route) => {
    retries += 1;
    return route.continue();
  });
  await page.getByRole("button", { name: "Retry processing" }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toContainText(/assessment/i);
  await expect(dialog).toContainText(/attempt 1/i);
  await dialog.getByRole("button", { name: "Cancel" }).click();
  expect(retries).toBe(0);
});

test("ADMIN-JOBS-009: retry failure remains actionable and success can be dismissed", async ({ page }) => {
  await resetScreenFixture(page, "09");
  await signIn(page, "Casey Rivera");
  await page.goto("/admin/jobs");
  let failRetry = true;
  await page.route("**/api/admin/jobs/**/retry", (route) => failRetry
    ? route.fulfill({ status: 503, json: { error: "Retry service unavailable." } })
    : route.continue());

  await page.getByRole("button", { name: "Retry processing" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Retry processing" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Retry service unavailable." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Retry processing" })).toBeEnabled();

  failRetry = false;
  await page.getByRole("button", { name: "Retry processing" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Retry processing" }).click();
  const success = page.getByRole("alert").filter({ hasText: "Retry started for" });
  await expect(success).toBeVisible();
  await success.getByRole("button", { name: "Dismiss message" }).click();
  await expect(success).toHaveCount(0);
});
