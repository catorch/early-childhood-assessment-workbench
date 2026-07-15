import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";

import { expect, test, type APIResponse, type Page } from "@playwright/test";

import { resetScreenFixture, signIn } from "./helpers";

const observationPath = "tests/fixtures/synthetic-observation.mp4";

async function responseJson<T>(response: APIResponse): Promise<T> {
  expect(response.ok(), await response.text()).toBe(true);
  return response.json() as Promise<T>;
}

async function uploadObservation(page: Page, assessmentId: string) {
  const bytes = await readFile(observationPath);
  const checksumSha256 = createHash("sha256").update(bytes).digest("hex");
  return page.request.post(`/api/assessments/${assessmentId}/upload`, {
    multipart: {
      video: { name: "synthetic-observation.mp4", mimeType: "video/mp4", buffer: bytes },
      durationSeconds: "3",
      checksumSha256
    }
  });
}

test("assessment creation is authorized, versioned, and idempotent", async ({ page }) => {
  await resetScreenFixture(page, "02");
  await signIn(page);

  const requestId = randomUUID();
  const command = { childId: "child-1001", observationDate: "2026-07-14", requestId };
  const first = await page.request.post("/api/assessments", { data: command });
  const firstPayload = await responseJson<{
    assessment: {
      id: string;
      contextSnapshot: { ageMonthsAtObservation: number; processingAllowedAtCreation: boolean };
      contentCatalogVersion: string;
      scoringContractVersion: string;
    };
  }>(first);
  const repeated = await page.request.post("/api/assessments", { data: command });
  const repeatedPayload = await responseJson<typeof firstPayload>(repeated);

  expect(first.status()).toBe(201);
  expect(repeated.status()).toBe(201);
  expect(repeatedPayload.assessment.id).toBe(firstPayload.assessment.id);
  expect(firstPayload.assessment.contextSnapshot).toMatchObject({
    ageMonthsAtObservation: 19,
    processingAllowedAtCreation: true
  });
  expect(firstPayload.assessment.contentCatalogVersion).toMatch(/^help-2-/);
  expect(firstPayload.assessment.scoringContractVersion).toMatch(/^help-scoring-/);

  const changedPayload = await page.request.post("/api/assessments", {
    data: { ...command, childId: "child-1024" }
  });
  expect(changedPayload.status()).toBe(409);
  await expect(changedPayload.json()).resolves.toMatchObject({
    error: expect.stringContaining("already used")
  });

  const permissionBlocked = await page.request.post("/api/assessments", {
    data: { childId: "child-1048", observationDate: "2026-07-14", requestId: randomUUID() }
  });
  expect(permissionBlocked.status()).toBe(409);
  const assessmentList = await responseJson<{ assessments: Array<{ id: string; childExternalId: string }> }>(
    await page.request.get("/api/assessments?filter=active&search=1001")
  );
  expect(assessmentList.assessments.length).toBeGreaterThan(0);
  expect(assessmentList.assessments.every((item) => item.childExternalId === "Child 1001")).toBe(true);
  expect((await page.request.get(`/api/assessments?filter=active&search=${"x".repeat(101)}`)).status()).toBe(400);
});

test("child history, search filters, and stale next actions stay assignment-scoped", async ({ page }) => {
  await resetScreenFixture(page, "02");
  await signIn(page);

  const children = await responseJson<{
    children: Array<{ id: string; assessments: Array<{ id: string; actionHref: string; actionLabel: string }> }>;
  }>(await page.request.get("/api/children"));
  expect(children.children.map((child) => child.id)).toEqual(["child-1001", "child-1024", "child-1048"]);
  const routes = children.children.flatMap((child) => child.assessments.map((assessment) => [assessment.id, assessment.actionHref, assessment.actionLabel]));
  expect(routes).toEqual(expect.arrayContaining([
    ["assessment-upload-ready", "/assessments/new?childId=child-1001&assessmentId=assessment-upload-ready", "Start processing"],
    ["assessment-processing", "/assessments/assessment-processing/processing", "View status"],
    ["assessment-ready", "/assessments/assessment-ready/review", "Start review"],
    ["assessment-complete", "/assessments/assessment-complete/summary", "Finish review"],
    ["assessment-final", "/assessments/assessment-final/final", "View final"]
  ]));

  const detailText = await (await page.request.get("/api/children/child-1001")).text();
  expect(detailText).not.toContain("storageKey");
  expect(detailText).not.toContain("checksumSha256");
  expect(JSON.parse(detailText).assessments.length).toBeGreaterThan(0);
  const finalized = await responseJson<{ assessments: Array<{ status: string }> }>(
    await page.request.get("/api/assessments?filter=finalized")
  );
  expect(finalized.assessments.every((assessment) => assessment.status === "FINALIZED")).toBe(true);
  const noMatch = await responseJson<{ assessments: unknown[] }>(
    await page.request.get("/api/assessments?filter=all&search=not-a-child")
  );
  expect(noMatch.assessments).toEqual([]);

  await page.goto("/assessments/new?childId=child-1001&assessmentId=assessment-ready");
  await page.waitForURL("**/assessments/assessment-ready/review");
});

test("assignment revocation and access deactivation take effect on the next request", async ({ browser, page }) => {
  await resetScreenFixture(page, "02");
  const educatorContext = await browser.newContext();
  const adminContext = await browser.newContext();
  const educator = await educatorContext.newPage();
  const admin = await adminContext.newPage();
  await signIn(educator);
  await signIn(admin, "Casey Rivera");

  expect((await educator.request.get("/api/children/child-1001")).status()).toBe(200);
  const revoke = await admin.request.post("/api/admin/access", {
    data: { action: "SET_ASSIGNMENT", userId: "user-educator-1", childId: "child-1001", active: false }
  });
  expect(revoke.ok(), await revoke.text()).toBe(true);
  expect((await educator.request.get("/api/children/child-1001")).status()).toBe(404);
  expect((await educator.request.get("/api/assessments/assessment-ready/review")).status()).toBe(404);

  const deactivate = await admin.request.post("/api/admin/access", {
    data: { action: "SET_ACCESS", userId: "user-educator-1", active: false }
  });
  expect(deactivate.ok(), await deactivate.text()).toBe(true);
  expect((await educator.request.get("/api/session")).status()).toBe(401);

  await educatorContext.close();
  await adminContext.close();
});

test("signed sessions, origins, roles, and return paths fail closed", async ({ page, context }) => {
  await resetScreenFixture(page, "02");
  await signIn(page);

  const crossOrigin = await page.request.post("/api/assessments", {
    headers: { origin: "https://attacker.example.test", "sec-fetch-site": "cross-site" },
    data: { childId: "child-1001", observationDate: "2026-07-14", requestId: randomUUID() }
  });
  expect(crossOrigin.status()).toBe(403);

  const cookies = await context.cookies();
  const session = cookies.find((cookie) => cookie.name === "help_review_session");
  expect(session).toBeDefined();
  await context.addCookies([{
    name: "help_review_session",
    value: `${session!.value}forged`,
    domain: "127.0.0.1",
    path: "/",
    httpOnly: true,
    sameSite: "Lax"
  }]);
  expect((await page.request.get("/api/session")).status()).toBe(401);

  await page.goto("/session-expired?returnTo=https%3A%2F%2Fattacker.example.test%2Fcollect%3Ftoken%3Dsecret");
  const resume = page.getByRole("link", { name: "Sign in again" });
  await expect(resume).toHaveAttribute("href", "/sign-in?reason=expired&returnTo=%2Fchildren");
});

test("upload validation, replacement, removal, and browser-independent processing work", async ({ browser, page }) => {
  await resetScreenFixture(page, "17");
  await signIn(page);

  const invalidBytes = Buffer.from("not a real video");
  const invalidSignature = await page.request.post("/api/assessments/assessment-upload-ready/upload", {
    multipart: {
      video: { name: "fake.mp4", mimeType: "video/mp4", buffer: invalidBytes },
      durationSeconds: "3",
      checksumSha256: createHash("sha256").update(invalidBytes).digest("hex")
    }
  });
  expect(invalidSignature.status()).toBe(400);

  const bytes = await readFile(observationPath);
  const badChecksum = await page.request.post("/api/assessments/assessment-upload-ready/upload", {
    multipart: {
      video: { name: "synthetic-observation.mp4", mimeType: "video/mp4", buffer: bytes },
      durationSeconds: "3",
      checksumSha256: "0".repeat(64)
    }
  });
  expect(badChecksum.status()).toBe(400);

  const uploaded = await uploadObservation(page, "assessment-upload-ready");
  const uploadText = await uploaded.text();
  expect(uploaded.ok(), uploadText).toBe(true);
  expect(uploadText).not.toContain("checksumSha256");
  expect(uploadText).not.toContain("storageKey");
  const uploadPayload = JSON.parse(uploadText) as { video: { byteSize: number; durationSeconds: number } };
  expect(uploadPayload.video).toMatchObject({ byteSize: bytes.byteLength, durationSeconds: 3 });

  const started = await page.request.post("/api/assessments/assessment-upload-ready/process");
  expect(started.status()).toBe(202);
  await page.close();

  const returnContext = await browser.newContext();
  const returningEducator = await returnContext.newPage();
  await signIn(returningEducator);
  await expect.poll(async () => {
    const status = await returningEducator.request.get("/api/assessments/assessment-upload-ready/status");
    if (!status.ok()) return status.status();
    const payload = await status.json() as { assessment: { status: string } };
    return payload.assessment.status;
  }, { timeout: 15_000 }).toBe("READY_FOR_REVIEW");
  await returnContext.close();
});

test("upload commands enforce all sanitized limits and remain replay-safe", async ({ page }) => {
  await resetScreenFixture(page, "17");
  await signIn(page);

  const wrongType = await page.request.post("/api/assessments/assessment-upload-ready/upload", {
    multipart: {
      video: { name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("plain text") },
      durationSeconds: "3",
      checksumSha256: createHash("sha256").update("plain text").digest("hex")
    }
  });
  expect(wrongType.status()).toBe(400);

  const bytes = await readFile(observationPath);
  const tooLong = await page.request.post("/api/assessments/assessment-upload-ready/upload", {
    multipart: {
      video: { name: "synthetic-observation.mp4", mimeType: "video/mp4", buffer: bytes },
      durationSeconds: "301",
      checksumSha256: createHash("sha256").update(bytes).digest("hex")
    }
  });
  expect(tooLong.status()).toBe(400);

  const first = await responseJson<{ video: { id: string; originalFilename: string } }>(
    await uploadObservation(page, "assessment-upload-ready")
  );
  const second = await responseJson<{ video: { id: string; originalFilename: string } }>(
    await uploadObservation(page, "assessment-upload-ready")
  );
  expect(second.video.id).not.toBe(first.video.id);
  const projectionResponse = await page.request.get("/api/assessments/assessment-upload-ready/upload");
  const projectionText = await projectionResponse.text();
  expect(projectionResponse.ok(), projectionText).toBe(true);
  for (const forbidden of ["storageKey", "checksumSha256", "uploadedById", "suggestions", "decisions"]) {
    expect(projectionText).not.toContain(forbidden);
  }
  expect(JSON.parse(projectionText).video.id).toBe(second.video.id);

  const removed = await page.request.delete("/api/assessments/assessment-upload-ready/upload");
  expect(removed.ok(), await removed.text()).toBe(true);
  const replayedRemoval = await page.request.delete("/api/assessments/assessment-upload-ready/upload");
  expect(replayedRemoval.ok(), await replayedRemoval.text()).toBe(true);
  await expect((await page.request.get("/api/assessments/assessment-upload-ready/upload")).json())
    .resolves.toMatchObject({ video: null });

  await uploadObservation(page, "assessment-upload-ready");
  const [startOne, startTwo] = await Promise.all([
    page.request.post("/api/assessments/assessment-upload-ready/process"),
    page.request.post("/api/assessments/assessment-upload-ready/process")
  ]);
  expect([startOne.status(), startTwo.status()].every((status) => status === 202)).toBe(true);
  const [runOne, runTwo] = await Promise.all([
    startOne.json() as Promise<{ run: { id: string } }>,
    startTwo.json() as Promise<{ run: { id: string } }>
  ]);
  expect(runTwo.run.id).toBe(runOne.run.id);
});

test("private playback requires a current viewer grant and supports byte ranges", async ({ page }) => {
  await resetScreenFixture(page, "05");
  await signIn(page);

  const reviewResponse = await page.request.get("/api/assessments/assessment-ready/review");
  const reviewText = await reviewResponse.text();
  expect(reviewResponse.ok(), reviewText).toBe(true);
  expect(Buffer.byteLength(reviewText)).toBeLessThan(256 * 1024);
  expect(reviewText).not.toContain("storageKey");
  expect(reviewText).not.toContain("checksumSha256");
  expect(reviewText).not.toContain("providerPayload");
  const review = JSON.parse(reviewText) as {
    video: { playbackUrl: string };
    suggestions: Array<{ id: string }>;
    decisions: Array<{ suggestionId: string; revision: number }>;
  };

  expect((await page.request.get("/api/assessments/assessment-ready/video")).status()).toBe(404);
  const range = await page.request.get(review.video.playbackUrl, { headers: { range: "bytes=0-1023" } });
  expect(range.status()).toBe(206);
  expect(range.headers()["accept-ranges"]).toBe("bytes");
  expect((await range.body()).byteLength).toBeGreaterThan(0);
  expect((await range.body()).byteLength).toBeLessThanOrEqual(1024);

  const tampered = review.video.playbackUrl.replace(/.$/, (value) => value === "a" ? "b" : "a");
  expect((await page.request.get(tampered, { headers: { range: "bytes=0-15" } })).status()).toBe(404);

  const refreshed = await responseJson<{ playbackUrl: string; expiresAt: string }>(
    await page.request.post("/api/assessments/assessment-ready/video/grant")
  );
  expect(new Date(refreshed.expiresAt).getTime()).toBeGreaterThan(Date.now());
  expect((await page.request.get(refreshed.playbackUrl, { headers: { range: "bytes=16-31" } })).status()).toBe(206);
  const invalidRange = await page.request.get(refreshed.playbackUrl, { headers: { range: "bytes=999999999999999999999-" } });
  expect(invalidRange.status()).toBe(416);
});

test("review media renders real pixels and evidence timestamps seek the active video", async ({ page }) => {
  await resetScreenFixture(page, "05");
  await signIn(page);
  await page.goto("/assessments/assessment-ready/review");
  const video = page.locator("video").first();
  await expect(video).toBeVisible();
  await video.evaluate((element: HTMLVideoElement) => new Promise<void>((resolve, reject) => {
    if (element.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) return resolve();
    const timeout = window.setTimeout(() => reject(new Error("Video did not load.")), 8_000);
    element.addEventListener("loadeddata", () => {
      window.clearTimeout(timeout);
      resolve();
    }, { once: true });
  }));
  const pixels = await video.evaluate((element: HTMLVideoElement) => {
    const canvas = document.createElement("canvas");
    canvas.width = 16;
    canvas.height = 9;
    const context = canvas.getContext("2d");
    if (!context) return { width: 0, height: 0, energy: 0 };
    context.drawImage(element, 0, 0, canvas.width, canvas.height);
    const energy = context.getImageData(0, 0, canvas.width, canvas.height).data
      .reduce((total, value, index) => index % 4 === 3 ? total : total + value, 0);
    return { width: element.videoWidth, height: element.videoHeight, energy };
  });
  expect(pixels).toMatchObject({ width: 320, height: 180 });
  expect(pixels.energy).toBeGreaterThan(0);

  const timestamp = page.getByRole("button", { name: "0:02" }).first();
  await timestamp.click();
  await expect(timestamp).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.currentTime)).toBeGreaterThan(1.5);
});

test("every approved review origin is server-derived and restored after reload", async ({ page }) => {
  await resetScreenFixture(page, "05");
  await signIn(page);
  const initial = await responseJson<{
    suggestions: Array<{ id: string; draftCredit: "PRESENT" | "EMERGING" | "NOT_OBSERVED" | "NOT_APPLICABLE" | null }>;
  }>(await page.request.get("/api/assessments/assessment-ready/review"));
  const drafted = initial.suggestions.filter((suggestion) => suggestion.draftCredit !== null);
  const uncertain = initial.suggestions.find((suggestion) => suggestion.draftCredit === null)!;
  expect(drafted.length).toBeGreaterThanOrEqual(3);

  const commands = [
    {
      suggestion: drafted[0]!,
      mutation: { expectedRevision: 0, finalCredit: drafted[0]!.draftCredit, dismissed: false, note: "Accepted with direct observation." },
      origin: "ACCEPTED"
    },
    {
      suggestion: drafted[1]!,
      mutation: { expectedRevision: 0, finalCredit: drafted[1]!.draftCredit === "PRESENT" ? "EMERGING" : "PRESENT", dismissed: false, note: null },
      origin: "OVERRIDDEN"
    },
    {
      suggestion: uncertain,
      mutation: { expectedRevision: 0, finalCredit: "NOT_OBSERVED", dismissed: false, note: "Scored independently." },
      origin: "SCORED_INDEPENDENTLY"
    },
    {
      suggestion: drafted[2]!,
      mutation: { expectedRevision: 0, finalCredit: null, dismissed: true, note: "Outside this observation." },
      origin: "DISMISSED"
    }
  ] as const;
  for (const command of commands) {
    const saved = await responseJson<{ decision: { origin: string; note: string | null } }>(
      await page.request.patch(`/api/assessments/assessment-ready/suggestions/${command.suggestion.id}`, {
        data: command.mutation
      })
    );
    expect(saved.decision.origin).toBe(command.origin);
    expect(saved.decision.note).toBe(command.mutation.note);
  }

  const restored = await responseJson<{ decisions: Array<{ suggestionId: string; origin: string }> }>(
    await page.request.get("/api/assessments/assessment-ready/review")
  );
  expect(restored.decisions).toEqual(expect.arrayContaining(
    commands.map((command) => expect.objectContaining({ suggestionId: command.suggestion.id, origin: command.origin }))
  ));
});

test("review selection and bounded scroll context survive a hard refresh", async ({ page }) => {
  await resetScreenFixture(page, "05");
  await signIn(page);
  await page.goto("/assessments/assessment-ready/review");
  const editButtons = page.getByRole("button", { name: "Edit", exact: true });
  await expect(editButtons.first()).toBeVisible();
  expect(await editButtons.count()).toBeGreaterThan(2);
  await editButtons.nth(2).click();
  const selectedSkill = new URL(page.url()).searchParams.get("skill");
  expect(selectedSkill).toBeTruthy();
  const editorTitle = await page.locator("#editor-title").textContent();
  expect(editorTitle).toBeTruthy();

  await page.evaluate(() => window.scrollTo({ top: 500 }));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(100);
  const previousScroll = await page.evaluate(() => window.scrollY);
  await page.reload();

  await expect(page).toHaveURL(new RegExp(`skill=${selectedSkill}`));
  await expect(page.locator("#editor-title")).toHaveText(editorTitle!);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThanOrEqual(Math.min(previousScroll, 100));
});

test("review decisions survive reload, reject stale edits, and leave final records immutable", async ({ page }) => {
  await resetScreenFixture(page, "05");
  await signIn(page);
  const initial = await responseJson<{
    suggestions: Array<{ id: string }>;
    decisions: Array<{ suggestionId: string; revision: number }>;
  }>(await page.request.get("/api/assessments/assessment-ready/review"));
  const suggestionId = initial.suggestions[0]!.id;
  const current = initial.decisions.find((decision) => decision.suggestionId === suggestionId);
  const saved = await page.request.patch(`/api/assessments/assessment-ready/suggestions/${suggestionId}`, {
    data: { expectedRevision: current?.revision ?? 0, finalCredit: "EMERGING", dismissed: false, note: "Observed with support." }
  });
  const savedPayload = await responseJson<{ decision: { revision: number; finalCredit: string; note: string } }>(saved);
  expect(savedPayload.decision).toMatchObject({ finalCredit: "EMERGING", note: "Observed with support." });

  const reloaded = await responseJson<{ decisions: Array<{ suggestionId: string; revision: number; finalCredit: string }> }>(
    await page.request.get("/api/assessments/assessment-ready/review")
  );
  expect(reloaded.decisions).toContainEqual(expect.objectContaining({ suggestionId, finalCredit: "EMERGING" }));

  const stale = await page.request.patch(`/api/assessments/assessment-ready/suggestions/${suggestionId}`, {
    data: { expectedRevision: current?.revision ?? 0, finalCredit: "PRESENT", dismissed: false, note: null }
  });
  expect(stale.status()).toBe(409);
  await expect(stale.json()).resolves.toMatchObject({
    code: "REVISION_CONFLICT",
    currentDecision: { revision: savedPayload.decision.revision, finalCredit: "EMERGING" }
  });

  const finalizedProjection = await responseJson<{ assessment: { revision: number } }>(
    await page.request.get("/api/assessments/assessment-final/review")
  );
  const immutable = await page.request.patch(`/api/assessments/assessment-final/suggestions/run-final-suggestion-1`, {
    data: { expectedRevision: 1, finalCredit: "PRESENT", dismissed: false, note: null }
  });
  expect(finalizedProjection.assessment.revision).toBeGreaterThan(0);
  expect(immutable.status()).toBe(409);
});

test("summary finalization is complete-only, stale-safe, and idempotent", async ({ page }) => {
  await resetScreenFixture(page, "06");
  await signIn(page);

  const incomplete = await page.request.post("/api/assessments/assessment-incomplete/finalize", {
    data: { expectedRevision: 3, requestId: randomUUID() }
  });
  expect(incomplete.status()).toBe(409);

  const key = randomUUID();
  const stale = await page.request.post("/api/assessments/assessment-complete/finalize", {
    data: { expectedRevision: 2, requestId: randomUUID() }
  });
  expect(stale.status()).toBe(409);
  const finalized = await page.request.post("/api/assessments/assessment-complete/finalize", {
    data: { expectedRevision: 3, requestId: key }
  });
  const finalPayload = await responseJson<{ assessment: { status: string; finalizedAt: string; revision: number } }>(finalized);
  expect(finalPayload.assessment.status).toBe("FINALIZED");
  expect(finalPayload.assessment.finalizedAt).toBeTruthy();

  const repeated = await page.request.post("/api/assessments/assessment-complete/finalize", {
    data: { expectedRevision: 3, requestId: key }
  });
  const repeatedPayload = await responseJson<typeof finalPayload>(repeated);
  expect(repeatedPayload.assessment.finalizedAt).toBe(finalPayload.assessment.finalizedAt);
  expect(repeatedPayload.assessment.revision).toBe(finalPayload.assessment.revision);
  const finalRecord = await responseJson<{
    assessment: { status: string };
    summary: { progress: { remaining: number }; included: unknown[]; dismissed: unknown[] };
  }>(await page.request.get("/api/assessments/assessment-complete/final"));
  expect(finalRecord.assessment.status).toBe("FINALIZED");
  expect(finalRecord.summary.progress.remaining).toBe(0);
  expect(finalRecord.summary.included.length + finalRecord.summary.dismissed.length).toBeGreaterThan(0);
});

test("Admin access and processing support commands are scoped and replay-safe", async ({ page }) => {
  await resetScreenFixture(page, "09");
  await signIn(page, "Casey Rivera");

  const provision = await page.request.post("/api/admin/access", {
    data: {
      action: "PROVISION_STAFF",
      email: "new.educator@example.test",
      displayName: "New Educator",
      role: "EDUCATOR"
    }
  });
  const provisioned = await responseJson<{ educator: { id: string }; access: { active: boolean } }>(provision);
  expect(provisioned.access.active).toBe(true);
  const replay = await responseJson<typeof provisioned>(await page.request.post("/api/admin/access", {
    data: {
      action: "PROVISION_STAFF",
      email: "new.educator@example.test",
      displayName: "New Educator",
      role: "EDUCATOR"
    }
  }));
  expect(replay.educator.id).toBe(provisioned.educator.id);

  const assign = await page.request.post("/api/admin/access", {
    data: { action: "SET_ASSIGNMENT", userId: provisioned.educator.id, childId: "child-1001", active: true }
  });
  expect(assign.ok(), await assign.text()).toBe(true);
  const remove = await page.request.post("/api/admin/access", {
    data: { action: "SET_ASSIGNMENT", userId: provisioned.educator.id, childId: "child-1001", active: false }
  });
  expect(remove.ok(), await remove.text()).toBe(true);

  const jobsResponse = await page.request.get("/api/admin/jobs?filter=all&search=1001");
  const jobsText = await jobsResponse.text();
  expect(jobsResponse.ok(), jobsText).toBe(true);
  expect(jobsText).not.toContain("storageKey");
  expect(jobsText).not.toContain("providerPayload");
  expect(jobsText).not.toContain("externalJobId");
  expect(jobsText).not.toContain("requestedById");
  expect(jobsText).not.toContain("scoringConfigurationReference");
  const jobs = JSON.parse(jobsText) as { jobs: Array<{ run: { id: string }; retryEligible: boolean }> };
  expect(jobs.jobs.length).toBeGreaterThan(0);
  const eligible = jobs.jobs.find((job) => job.retryEligible);
  expect(eligible).toBeDefined();
  const [firstRetry, repeatedRetry] = await Promise.all([
    page.request.post(`/api/admin/jobs/${eligible!.run.id}/retry`),
    page.request.post(`/api/admin/jobs/${eligible!.run.id}/retry`)
  ]);
  expect(firstRetry.status()).toBe(202);
  expect(repeatedRetry.status()).toBe(202);
  const [firstRun, secondRun] = await Promise.all([
    firstRetry.json() as Promise<{ run: { id: string } }>,
    repeatedRetry.json() as Promise<{ run: { id: string } }>
  ]);
  expect(secondRun.run.id).toBe(firstRun.run.id);

  expect((await page.request.get("/api/assessments/assessment-ready/review")).status()).toBe(404);
  expect((await page.request.get("/api/assessments/assessment-ready/video")).status()).toBe(404);
});

test("health and public errors contain no protected runtime configuration", async ({ page }) => {
  await resetScreenFixture(page, "01");
  const health = await page.request.get("/api/health");
  const text = await health.text();
  expect(health.status()).toBe(200);
  expect(JSON.parse(text)).toEqual({ status: "ready", checkedAt: expect.any(String) });
  for (const forbidden of ["DATABASE_URL", "DIRECT_URL", "BLOB_READ_WRITE_TOKEN", "storageKey", "session"]) {
    expect(text).not.toContain(forbidden);
  }
  const signInResponse = await page.request.get("/sign-in");
  expect(signInResponse.headers()["strict-transport-security"]).toContain("max-age=31536000");
  expect(signInResponse.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(signInResponse.headers()["x-frame-options"]).toBe("DENY");

  await signIn(page);
  const sessionText = await (await page.request.get("/api/session")).text();
  for (const forbidden of ["externalSubject", "@example.test", "sandbox:educator"]) {
    expect(sessionText).not.toContain(forbidden);
  }
});
