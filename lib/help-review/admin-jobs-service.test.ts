import { describe, expect, it } from "vitest";

import { listAdminJobs, retryAdminProcessingRun } from "./admin-jobs-service";
import { createSanitizedPilotState } from "./fixtures";
import type { PilotAssessment } from "./models";

function failedAssessment(requestedAt = "2026-07-14T12:00:00.000Z"): PilotAssessment {
  return {
    id: "assessment-failed-1",
    childId: "child-1001",
    educatorId: "user-educator-1",
    observationDate: "2026-07-14",
    status: "FAILED",
    video: {
      id: "video-failed-1",
      storageKey: "video-failed-1.mp4",
      originalFilename: "synthetic.mp4",
      contentType: "video/mp4",
      byteSize: 3,
      uploadedAt: requestedAt,
      uploadedById: "user-educator-1"
    },
    runs: [{
      id: "run-failed-1",
      attempt: 1,
      status: "FAILED",
      externalJobId: "job-failed-1",
      requestedAt,
      requestedById: "user-educator-1",
      readyAt: null,
      completedAt: requestedAt,
      safeErrorCode: "SCORING_UNAVAILABLE"
    }],
    suggestions: [],
    decisions: [],
    finalizedAt: null,
    finalizedById: null,
    createdAt: requestedAt,
    updatedAt: requestedAt,
    revision: 1
  };
}

describe("Admin processing job service", () => {
  it("returns safe filtered metadata and marks old active attempts stuck", () => {
    const state = createSanitizedPilotState();
    state.assessments.push(failedAssessment());
    const base = failedAssessment();
    const stuck: PilotAssessment = {
      ...base,
      id: "assessment-stuck-1",
      video: { ...base.video!, id: "video-stuck-1", storageKey: "video-stuck-1.mp4" },
      runs: [{ ...base.runs[0]!, id: "run-stuck-1", externalJobId: "job-stuck-1", status: "RUNNING", completedAt: null }],
      status: "PROCESSING"
    };
    state.assessments.push(stuck);

    const result = listAdminJobs(state, {
      filter: "stuck",
      search: "stuck-1",
      now: new Date("2026-07-14T12:16:00.000Z")
    });
    expect(result.totalRelevant).toBe(2);
    expect(result.jobs).toHaveLength(1);
    expect(result.jobs[0]).toMatchObject({ stuck: true, retryEligible: true });
    const serialized = JSON.stringify(result.jobs[0]);
    for (const forbidden of ["provider", "storageKey", "externalJobId", "requestedById", "scoringConfigurationReference"]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it("creates exactly one linked retry and safely replays a concurrent command", () => {
    const state = createSanitizedPilotState();
    state.assessments.push(failedAssessment());
    const admin = state.users.find((user) => user.role === "ADMIN")!;

    const first = retryAdminProcessingRun(state, admin, "run-failed-1", new Date("2026-07-14T12:01:00.000Z"));
    const replay = retryAdminProcessingRun(state, admin, "run-failed-1", new Date("2026-07-14T12:01:01.000Z"));

    expect(first).toMatchObject({ blocked: false, replayed: false });
    expect(replay).toMatchObject({ blocked: false, replayed: true });
    expect(state.assessments[0]!.runs).toHaveLength(2);
    expect(state.assessments[0]!.runs[1]!.retryOfRunId).toBe("run-failed-1");
  });

  it("blocks retry after permission loss, missing video, review work, or a newer attempt", () => {
    const cases = ["permission", "video", "review", "newer", "terminal"] as const;
    for (const scenario of cases) {
      const state = createSanitizedPilotState();
      state.assessments.push(failedAssessment());
      if (scenario === "permission") {
        const childIndex = state.children.findIndex((child) => child.id === "child-1001");
        state.children[childIndex] = { ...state.children[childIndex]!, processingAllowed: false };
      }
      if (scenario === "video") state.assessments[0]!.video = null;
      if (scenario === "review") state.assessments[0]!.decisions.push({
        suggestionId: "suggestion-existing",
        educatorId: "user-educator-1",
        origin: "DISMISSED",
        finalCredit: null,
        dismissed: true,
        note: null,
        revision: 1,
        decidedAt: "2026-07-14T12:00:00.000Z"
      });
      if (scenario === "newer") state.assessments[0]!.runs.push({
        ...state.assessments[0]!.runs[0]!,
        id: "run-newer",
        attempt: 2,
        externalJobId: "job-newer"
      });
      if (scenario === "terminal") state.assessments[0]!.runs[0]!.safeErrorCode = "SCORING_AUTHENTICATION_FAILED";
      const admin = state.users.find((user) => user.role === "ADMIN")!;
      expect(retryAdminProcessingRun(state, admin, "run-failed-1")).toMatchObject({ blocked: true });
    }
  });
});
