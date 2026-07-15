import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { createSanitizedPilotState } from "./fixtures";
import type { PilotAssessment, PilotState } from "./models";
import {
  markStuckRuns,
  processQueuedRuns,
  type ProcessingCoordinatorDependencies
} from "./processing-coordinator";
import { FakeScoringGateway } from "./scoring-gateway";

const bytes = new Uint8Array([1, 2, 3]);

function queuedState(): PilotState {
  const state = createSanitizedPilotState();
  const assessment: PilotAssessment = {
    id: "assessment-processing-1",
    childId: "child-1001",
    educatorId: "user-educator-1",
    observationDate: "2026-07-14",
    status: "PROCESSING",
    video: {
      id: "video-processing-1",
      storageKey: "video-processing-1.mp4",
      originalFilename: "synthetic.mp4",
      contentType: "video/mp4",
      byteSize: bytes.byteLength,
      durationSeconds: 120,
      checksumSha256: createHash("sha256").update(bytes).digest("hex"),
      uploadedAt: "2026-07-14T12:00:00.000Z",
      uploadedById: "user-educator-1"
    },
    runs: [{
      id: "run-processing-1",
      attempt: 1,
      status: "QUEUED",
      externalJobId: "job-processing-1",
      requestedAt: new Date().toISOString(),
      requestedById: "user-educator-1",
      readyAt: null,
      completedAt: null,
      safeErrorCode: null
    }],
    suggestions: [],
    decisions: [],
    finalizedAt: null,
    finalizedById: null,
    createdAt: "2026-07-14T12:00:00.000Z",
    updatedAt: "2026-07-14T12:00:00.000Z",
    revision: 1
  };
  state.assessments.push(assessment);
  return state;
}

function dependencies(state: PilotState, scoringGateway = new FakeScoringGateway()): ProcessingCoordinatorDependencies {
  return {
    readState: async () => structuredClone(state),
    updateState: async <T>(mutation: (current: PilotState) => T | Promise<T>) => mutation(state),
    scoringGateway,
    videoStorage: {
      name: "memory",
      readForScoring: async () => ({ kind: "bytes", bytes, contentType: "video/mp4" }),
      checksum: async () => createHash("sha256").update(bytes).digest("hex")
    }
  };
}

describe("durable processing coordinator", () => {
  it("claims and commits one complete validated result without a browser poll", async () => {
    const state = queuedState();
    await expect(processQueuedRuns(1, dependencies(state))).resolves.toEqual({ processed: 1 });
    const assessment = state.assessments[0]!;
    expect(assessment.status).toBe("READY_FOR_REVIEW");
    expect(assessment.runs[0]).toMatchObject({ status: "COMPLETED", safeErrorCode: null });
    expect(assessment.suggestions.length).toBeGreaterThan(0);
    expect(assessment.runs[0]!.scoringConfigurationReference).toContain("fake:");
  });

  it("commits no partial suggestions for an invalid or retryable provider result", async () => {
    const invalidState = queuedState();
    await processQueuedRuns(1, dependencies(invalidState, new FakeScoringGateway("invalid-evidence")));
    expect(invalidState.assessments[0]).toMatchObject({ status: "FAILED", suggestions: [] });
    expect(invalidState.assessments[0]!.runs[0]!.safeErrorCode).toBe("INVALID_RESULT");

    const retryableState = queuedState();
    await processQueuedRuns(1, dependencies(retryableState, new FakeScoringGateway("retryable-failure")));
    expect(retryableState.assessments[0]!.runs[0]!.safeErrorCode).toBe("SCORING_UNAVAILABLE");
  });

  it("fails queued and running work after the confirmed stuck threshold", () => {
    const state = queuedState();
    state.assessments[0]!.runs[0] = {
      ...state.assessments[0]!.runs[0]!,
      requestedAt: "2026-07-14T12:00:00.000Z"
    };
    expect(markStuckRuns(state, new Date("2026-07-14T12:16:00.000Z"))).toBe(1);
    expect(state.assessments[0]).toMatchObject({ status: "FAILED" });
    expect(state.assessments[0]!.runs[0]).toMatchObject({ status: "FAILED", safeErrorCode: "PROCESSING_STUCK" });
  });

  it("fails closed on source integrity mismatch and never replaces existing review work", async () => {
    const integrityState = queuedState();
    integrityState.assessments[0]!.video = {
      ...integrityState.assessments[0]!.video!,
      checksumSha256: "0".repeat(64)
    };
    await processQueuedRuns(1, dependencies(integrityState));
    expect(integrityState.assessments[0]).toMatchObject({ status: "FAILED", suggestions: [] });
    expect(integrityState.assessments[0]!.runs[0]!.safeErrorCode).toBe("VIDEO_UNAVAILABLE");

    const reviewState = queuedState();
    reviewState.assessments[0]!.decisions.push({
      suggestionId: "existing-suggestion",
      educatorId: "user-educator-1",
      origin: "DISMISSED",
      finalCredit: null,
      dismissed: true,
      note: null,
      revision: 1,
      decidedAt: "2026-07-14T12:00:00.000Z"
    });
    await expect(processQueuedRuns(1, dependencies(reviewState))).resolves.toEqual({ processed: 0 });
    expect(reviewState.assessments[0]!.decisions).toHaveLength(1);
    expect(reviewState.assessments[0]!.runs[0]).toMatchObject({
      status: "FAILED",
      safeErrorCode: "RESULT_REPLACEMENT_BLOCKED"
    });
  });
});
