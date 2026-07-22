import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { createAdminAccessService } from "./admin-access-service";
import { createAssessmentService } from "./assessment-service";
import { createChildService } from "./child-service";
import { createFakeScoringResult } from "./fake-scoring";
import { createSanitizedPilotState } from "./fixtures";
import { configuredHelpCatalog } from "./help-catalog";
import type { PilotAssessment, PilotState } from "./models";
import { createReviewService, invalidAtypicalCredit } from "./review-service";
import { sandboxIdentity, SESSION_COOKIE } from "./server-auth";
import { createVideoAssetService } from "./video-asset-service";

function inMemoryRepository(initial: PilotState) {
  let state = structuredClone(initial);
  return {
    readState: async () => structuredClone(state),
    updateState: async <T>(mutation: (current: PilotState) => T | Promise<T>) => {
      const next = structuredClone(state);
      const result = await mutation(next);
      state = next;
      return result;
    },
    current: () => state
  };
}

function requestFor(userId: string) {
  return new NextRequest("https://pilot.example.test/api/test", {
    headers: { cookie: `${SESSION_COOKIE}=${sandboxIdentity.issue(userId)}` }
  });
}

describe("injectable application services", () => {
  it("restricts atypical variants to the applicable regulatory/sensory key", () => {
    expect(invalidAtypicalCredit("0.0 Regulatory/Sensory Organization", "ATYPICAL", ["A_PLUS"]))
      .toContain("require A+");
    expect(invalidAtypicalCredit("0.0 Regulatory/Sensory Organization", "ATYPICAL_MINUS", ["A_PLUS"]))
      .toContain("defined for this");
    expect(invalidAtypicalCredit("0.0 Regulatory/Sensory Organization", "ATYPICAL_PLUS", ["A_PLUS"]))
      .toBeNull();
    expect(invalidAtypicalCredit("2.0 Language", "ATYPICAL_PLUS")).toContain("reserved");
  });

  it("creates immutable, idempotent assessment contracts through an injected repository", async () => {
    const repository = inMemoryRepository(createSanitizedPilotState());
    const service = createAssessmentService(repository);
    const request = requestFor("user-educator-1");
    const command = {
      childId: "child-1001",
      observationDate: "2026-07-14",
      requestId: "00000000-0000-4000-8000-000000000001"
    };

    const first = await service.create(request, command);
    const repeated = await service.create(request, command);
    expect(repeated.id).toBe(first.id);
    expect(first.contextSnapshot).toMatchObject({
      ageMonthsAtObservation: 19,
      processingAllowedAtCreation: true
    });
    expect(first.contentCatalogVersion).toMatch(/^help-2-/);
    expect(first.scoringContractVersion).toMatch(/^help-scoring-/);
    expect(repository.current().assessments).toHaveLength(1);
  });

  it("persists revision-checked decisions and complete-only finalization", async () => {
    const state = createSanitizedPilotState();
    const suggestions = [...createFakeScoringResult("run-service")];
    state.assessments.push({
      id: "assessment-service",
      childId: "child-1001",
      educatorId: "user-educator-1",
      observationDate: "2026-07-14",
      contextSnapshot: {
        ageMonthsAtObservation: 19,
        supportContext: "NONE_REPORTED",
        contextLabel: "IFSP: No",
        processingAllowedAtCreation: true,
        capturedAt: "2026-07-14T13:00:00.000Z",
        source: "SANITIZED_ADMIN"
      },
      contentCatalogVersion: "help-2-provisional-2026-07",
      scoringContractVersion: "help-scoring-v0",
      status: "READY_FOR_REVIEW",
      video: null,
      runs: [],
      suggestions,
      decisions: [],
      finalizedAt: null,
      finalizedById: null,
      createdAt: "2026-07-14T13:00:00.000Z",
      updatedAt: "2026-07-14T13:00:00.000Z",
      revision: 0,
      clientRequestId: "00000000-0000-4000-8000-000000000002",
      finalizationKey: null
    });
    const repository = inMemoryRepository(state);
    const service = createReviewService(repository);
    const request = requestFor("user-educator-1");

    const firstSuggestion = suggestions[0]!;
    const saved = await service.saveDecision(request, "assessment-service", firstSuggestion.id, {
      expectedRevision: 0,
      finalCredit: "PRESENT",
      dismissed: false,
      note: "Educator context"
    });
    expect(saved).toMatchObject({ decision: { revision: 1, finalCredit: "PRESENT" } });
    const stale = await service.saveDecision(request, "assessment-service", firstSuggestion.id, {
      expectedRevision: 0,
      finalCredit: "EMERGING",
      dismissed: false,
      note: null
    });
    expect(stale).toMatchObject({ conflict: expect.stringContaining("another session") });

    const incomplete = await service.finalize(request, "assessment-service", {
      expectedRevision: 1,
      requestId: "00000000-0000-4000-8000-000000000003"
    });
    expect(incomplete).toMatchObject({ finalized: false, remaining: suggestions.length - 1 });

    for (const suggestion of suggestions.slice(1)) {
      const result = await service.saveDecision(request, "assessment-service", suggestion.id, {
        expectedRevision: 0,
        finalCredit: suggestion.draftCredit ?? "PRESENT",
        dismissed: false,
        note: null
      });
      expect(result).toHaveProperty("decision");
    }
    const revision = repository.current().assessments[0]!.revision!;
    const finalized = await service.finalize(request, "assessment-service", {
      expectedRevision: revision,
      requestId: "00000000-0000-4000-8000-000000000004"
    });
    expect(finalized).toMatchObject({ finalized: true, projection: { assessment: { status: "FINALIZED" } } });
    expect(repository.current().supportEvents?.map((event) => event.type)).toContain("ASSESSMENT_FINALIZED");
  });

  it("adds an educator skill with its decision atomically and keeps every guard closed", async () => {
    const state = createSanitizedPilotState();
    const suggestions = [...createFakeScoringResult("run-manual")].slice(0, 6);
    state.assessments.push({
      id: "assessment-manual",
      childId: "child-1001",
      educatorId: "user-educator-1",
      observationDate: "2026-07-15",
      contextSnapshot: {
        ageMonthsAtObservation: 19,
        supportContext: "NONE_REPORTED",
        contextLabel: "IFSP: No",
        processingAllowedAtCreation: true,
        capturedAt: "2026-07-15T13:00:00.000Z",
        source: "SANITIZED_ADMIN"
      },
      contentCatalogVersion: "help-2-provisional-2026-07",
      scoringContractVersion: "help-scoring-v0",
      status: "READY_FOR_REVIEW",
      video: null,
      runs: [],
      suggestions,
      decisions: [],
      finalizedAt: null,
      finalizedById: null,
      createdAt: "2026-07-15T13:00:00.000Z",
      updatedAt: "2026-07-15T13:00:00.000Z",
      revision: 0,
      clientRequestId: "00000000-0000-4000-8000-000000000021",
      finalizationKey: null
    });
    const repository = inMemoryRepository(state);
    const service = createReviewService(repository);
    const request = requestFor("user-educator-1");
    const suggestedIds = new Set(suggestions.map((suggestion) => suggestion.sourceSkillId));
    const missingSkillId = ["help-2.18", "help-6.22", "help-5.41"].find((id) => !suggestedIds.has(id))!;

    await expect(service.addManualSkill(requestFor("user-educator-2"), "assessment-manual", {
      sourceSkillId: missingSkillId,
      finalCredit: "PRESENT",
      note: null
    })).rejects.toThrow("unavailable");

    const duplicate = await service.addManualSkill(request, "assessment-manual", {
      sourceSkillId: suggestions[0]!.sourceSkillId,
      finalCredit: "PRESENT",
      note: null
    });
    expect(duplicate).toMatchObject({ conflict: expect.stringContaining("already part") });

    const unknown = await service.addManualSkill(request, "assessment-manual", {
      sourceSkillId: "help-nonexistent",
      finalCredit: "PRESENT",
      note: null
    });
    expect(unknown).toMatchObject({ invalid: expect.stringContaining("catalogue") });

    const added = await service.addManualSkill(request, "assessment-manual", {
      sourceSkillId: missingSkillId,
      finalCredit: "EMERGING",
      note: "Observed during free play."
    });
    if (!("suggestion" in added) || !added.suggestion || !added.decision || !added.summary) {
      throw new Error("Expected the skill to be added.");
    }
    expect(added.suggestion).toMatchObject({ source: "EDUCATOR", draftCredit: null, evidence: [] });
    expect(added.decision).toMatchObject({ origin: "MANUALLY_ADDED", finalCredit: "EMERGING", revision: 1 });
    expect(added.summary.origins.MANUALLY_ADDED).toBe(1);
    expect(added.summary.progress).toMatchObject({ total: 7, actioned: 1 });
    expect(added.suggestion.sourceOrder).toBe(
      configuredHelpCatalog().skills.find((skill) => skill.sourceSkillId === missingSkillId)?.sourceOrder
    );

    const secondAttempt = await service.addManualSkill(request, "assessment-manual", {
      sourceSkillId: missingSkillId,
      finalCredit: "PRESENT",
      note: null
    });
    expect(secondAttempt).toMatchObject({ conflict: expect.stringContaining("already part"), existingSuggestionId: added.suggestion.id });

    const edited = await service.saveDecision(request, "assessment-manual", added.suggestion.id, {
      expectedRevision: 1,
      finalCredit: "PRESENT",
      dismissed: false,
      note: null
    });
    expect(edited).toMatchObject({ decision: { origin: "MANUALLY_ADDED", finalCredit: "PRESENT", revision: 2 } });

    repository.current().assessments.find((candidate) => candidate.id === "assessment-manual")!.status = "FINALIZED";
    const afterFinal = await service.addManualSkill(request, "assessment-manual", {
      sourceSkillId: "help-1.52",
      finalCredit: "PRESENT",
      note: null
    });
    expect(afterFinal).toMatchObject({ conflict: expect.stringContaining("read-only") });
  });

  it("projects only assigned children and resolves each authorized child detail", async () => {
    const repository = inMemoryRepository(createSanitizedPilotState());
    const assessments = createAssessmentService(repository);
    const children = createChildService(repository);
    const educatorRequest = requestFor("user-educator-1");
    await assessments.create(educatorRequest, {
      childId: "child-1001",
      observationDate: "2026-07-14",
      requestId: "00000000-0000-4000-8000-000000000010"
    });

    const assigned = await children.listAssigned(educatorRequest);
    expect(assigned.children.map((child) => child.id)).toEqual(["child-1001", "child-1024", "child-1048"]);
    expect(assigned.children[0]!.assessments[0]).toMatchObject({ actionLabel: "Continue upload" });
    await expect(children.detail(requestFor("user-educator-2"), "child-1001")).rejects.toThrow("unavailable");
  });

  it("keeps repeated finalized assessments separate with immutable age snapshots for progress", async () => {
    const state = createSanitizedPilotState();
    const suggestions = [...createFakeScoringResult("run-progress")].slice(0, 2);
    const finalized = (
      id: string,
      observationDate: string,
      ageMonthsAtObservation: number,
      firstCredit: "PRESENT" | "EMERGING"
    ): PilotAssessment => {
      const assessmentSuggestions = suggestions.map((suggestion) => ({ ...suggestion, id: `${id}-${suggestion.id}` }));
      return ({
      id,
      childId: "child-1001",
      educatorId: "user-educator-1",
      observationDate,
      contextSnapshot: {
        ageMonthsAtObservation,
        supportContext: "NONE_REPORTED",
        contextLabel: null,
        processingAllowedAtCreation: true,
        capturedAt: `${observationDate}T12:00:00.000Z`,
        source: "SANITIZED_ADMIN"
      },
      status: "FINALIZED",
      video: null,
      runs: [],
      suggestions: assessmentSuggestions,
      decisions: assessmentSuggestions.map((suggestion, index) => ({
        suggestionId: suggestion.id,
        educatorId: "user-educator-1",
        origin: "SCORED_INDEPENDENTLY",
        finalCredit: index === 0 ? firstCredit : "PRESENT",
        dismissed: false,
        concernFlag: false,
        note: null,
        revision: 1,
        decidedAt: `${observationDate}T13:00:00.000Z`
      })),
      finalizedAt: `${observationDate}T13:00:00.000Z`,
      finalizedById: "user-educator-1",
      createdAt: `${observationDate}T12:00:00.000Z`,
      updatedAt: `${observationDate}T13:00:00.000Z`,
      revision: 3
    });
    };
    state.assessments.push(
      finalized("assessment-progress-1", "2026-07-01", 18, "EMERGING"),
      finalized("assessment-progress-2", "2026-07-15", 19, "PRESENT")
    );
    const detail = await createChildService(inMemoryRepository(state)).detail(
      requestFor("user-educator-1"),
      "child-1001"
    );

    expect(detail.progress.map((assessment) => [assessment.id, assessment.ageMonthsAtObservation]))
      .toEqual([["assessment-progress-1", 18], ["assessment-progress-2", 19]]);
    expect(detail.progress[0]?.skills[0]?.finalCredit).toBe("EMERGING");
    expect(detail.progress[1]?.skills[0]?.finalCredit).toBe("PRESENT");
    expect(detail.assessments).toHaveLength(2);
  });

  it("commits, replays, replaces, revokes, and removes one verified video asset", async () => {
    const repository = inMemoryRepository(createSanitizedPilotState());
    const request = requestFor("user-educator-1");
    const assessment = await createAssessmentService(repository).create(request, {
      childId: "child-1001",
      observationDate: "2026-07-14",
      requestId: "00000000-0000-4000-8000-000000000011"
    });
    const videos = createVideoAssetService(repository);
    const firstAuthorization = await videos.authorizeUpload(request, assessment.id);
    expect(firstAuthorization).toMatchObject({ blocked: false, expectedRevision: 0 });
    if (firstAuthorization.blocked) throw new Error("Expected upload authorization.");
    const firstVideo = {
      id: "video-service-1",
      storageKey: "private/video-service-1.mp4",
      originalFilename: "observation.mp4",
      contentType: "video/mp4",
      byteSize: 64,
      durationSeconds: 3,
      checksumSha256: "a".repeat(64),
      uploadedAt: "2026-07-14T14:00:00.000Z",
      uploadedById: firstAuthorization.actorId
    };
    const first = await videos.commitCompletedUpload({
      assessmentId: assessment.id,
      actorId: firstAuthorization.actorId,
      expectedRevision: firstAuthorization.expectedRevision,
      video: firstVideo
    });
    expect(first).toMatchObject({ blocked: false, oldStorageKey: null });
    await expect(videos.commitCompletedUpload({
      assessmentId: assessment.id,
      actorId: firstAuthorization.actorId,
      expectedRevision: firstAuthorization.expectedRevision,
      video: firstVideo
    })).resolves.toMatchObject({ blocked: false, oldStorageKey: null });

    const replacementAuthorization = await videos.authorizeUpload(request, assessment.id);
    if (replacementAuthorization.blocked) throw new Error("Expected replacement authorization.");
    const replacement = await videos.commitCompletedUpload({
      assessmentId: assessment.id,
      actorId: replacementAuthorization.actorId,
      expectedRevision: replacementAuthorization.expectedRevision,
      video: { ...firstVideo, id: "video-service-2", storageKey: "private/video-service-2.mp4" }
    });
    expect(replacement).toMatchObject({ blocked: false, oldStorageKey: firstVideo.storageKey });

    const staleAuthorization = await videos.authorizeUpload(request, assessment.id);
    if (staleAuthorization.blocked) throw new Error("Expected upload authorization before revocation.");
    repository.current().assignments.find((item) => item.childId === "child-1001")!.active = false;
    await expect(videos.commitCompletedUpload({
      assessmentId: assessment.id,
      actorId: staleAuthorization.actorId,
      expectedRevision: staleAuthorization.expectedRevision,
      video: { ...firstVideo, id: "video-service-3", storageKey: "private/video-service-3.mp4" }
    })).rejects.toThrow("unavailable");
    repository.current().assignments.find((item) => item.childId === "child-1001")!.active = true;

    const removed = await videos.remove(request, assessment.id);
    expect(removed).toMatchObject({ blocked: false, storageKey: "private/video-service-2.mp4" });
    expect(repository.current().assessments[0]!.video).toBeNull();
  });

  it("deduplicates repeated processing commands and blocks terminal retry categories", async () => {
    const repository = inMemoryRepository(createSanitizedPilotState());
    const request = requestFor("user-educator-1");
    const assessments = createAssessmentService(repository);
    const assessment = await assessments.create(request, {
      childId: "child-1001",
      observationDate: "2026-07-14",
      requestId: "00000000-0000-4000-8000-000000000012"
    });
    repository.current().assessments[0]!.video = {
      id: "video-processing-command",
      storageKey: "private/video-processing-command.mp4",
      originalFilename: "observation.mp4",
      contentType: "video/mp4",
      byteSize: 64,
      durationSeconds: 3,
      checksumSha256: "a".repeat(64),
      uploadedAt: "2026-07-14T14:00:00.000Z",
      uploadedById: "user-educator-1"
    };
    const first = await assessments.startProcessing(request, assessment.id);
    const replay = await assessments.startProcessing(request, assessment.id);
    expect(first).toMatchObject({ blocked: false });
    expect(replay).toMatchObject({ blocked: false });
    if (first.blocked || replay.blocked) throw new Error("Expected processing command.");
    expect(replay.run.id).toBe(first.run.id);
    expect(repository.current().assessments[0]!.runs).toHaveLength(1);

    repository.current().assessments[0]!.status = "FAILED";
    repository.current().assessments[0]!.runs[0]!.status = "FAILED";
    repository.current().assessments[0]!.runs[0]!.safeErrorCode = "SCORING_AUTHENTICATION_FAILED";
    repository.current().assessments[0]!.runs[0]!.completedAt = "2026-07-14T14:01:00.000Z";
    await expect(assessments.startProcessing(request, assessment.id)).resolves.toMatchObject({ blocked: true });
  });

  it("makes sanitized Admin provision and assignment commands replay-safe and traceable", async () => {
    const repository = inMemoryRepository(createSanitizedPilotState());
    const admin = createAdminAccessService(repository);
    const request = requestFor("user-admin-1");
    const command = {
      action: "PROVISION_STAFF" as const,
      email: "new.educator@example.test",
      displayName: "New Educator",
      role: "EDUCATOR" as const
    };
    const first = await admin.mutate(request, command);
    const replay = await admin.mutate(request, command);
    const firstEducator = "educator" in first ? first.educator : undefined;
    const replayEducator = "educator" in replay ? replay.educator : undefined;
    if (!firstEducator || !replayEducator) throw new Error("Expected provision result.");
    expect(replayEducator.id).toBe(firstEducator.id);
    await admin.mutate(request, { action: "SET_ASSIGNMENT", userId: firstEducator.id, childId: "child-1001", active: true });
    await admin.mutate(request, { action: "SET_ASSIGNMENT", userId: firstEducator.id, childId: "child-1001", active: false });
    await expect(admin.mutate(request, { action: "SET_ACCESS", userId: "user-admin-1", active: false }))
      .rejects.toThrow("cannot deactivate");
    expect(repository.current().supportEvents?.map((event) => event.type)).toEqual(
      expect.arrayContaining(["ACCESS_CHANGED", "ASSIGNMENT_CHANGED"])
    );
  });
});
