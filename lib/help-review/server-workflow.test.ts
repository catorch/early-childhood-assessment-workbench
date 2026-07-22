import { describe, expect, it } from "vitest";

import { createSanitizedPilotState } from "./fixtures";
import type { PilotAssessment } from "./models";
import { assessmentActionLabel, assessmentDestination } from "./presentation";
import {
  findExistingAssessmentForCreate,
  materializeCompletedRun,
  reviewProjection,
  safeProcessingError
} from "./server-workflow";

function processingAssessment(filename = "observation.mp4"): PilotAssessment {
  return {
    id: "assessment-test",
    childId: "child-1001",
    educatorId: "user-educator-1",
    observationDate: "2026-07-13",
    status: "PROCESSING",
    video: {
      id: "video-test",
      storageKey: "video-test.mp4",
      originalFilename: filename,
      contentType: "video/mp4",
      byteSize: 12,
      uploadedAt: "2026-07-13T14:00:00.000Z",
      uploadedById: "user-educator-1"
    },
    runs: [{
      id: "run-test",
      attempt: 1,
      status: "RUNNING",
      externalJobId: "sandbox-job-test",
      requestedAt: "2026-07-13T14:00:00.000Z",
      requestedById: "user-educator-1",
      readyAt: "2026-07-13T14:00:01.000Z",
      completedAt: null,
      safeErrorCode: null
    }],
    suggestions: [],
    decisions: [],
    finalizedAt: null,
    finalizedById: null,
    createdAt: "2026-07-13T14:00:00.000Z",
    updatedAt: "2026-07-13T14:00:00.000Z",
    revision: 1,
    finalizationKey: null
  };
}

describe("assessment workflow state", () => {
  it("commits the complete validated scoring result before review is ready", () => {
    const assessment = processingAssessment();
    materializeCompletedRun(assessment, new Date("2026-07-13T14:00:02.000Z"));

    expect(assessment.status).toBe("READY_FOR_REVIEW");
    expect(assessment.runs[0]?.status).toBe("COMPLETED");
    expect(assessment.suggestions).toHaveLength(8);
  });

  it("shows no partial suggestions when the adapter result fails validation", () => {
    const assessment = processingAssessment("invalid-result.mp4");
    materializeCompletedRun(assessment, new Date("2026-07-13T14:00:02.000Z"));

    expect(assessment.status).toBe("FAILED");
    expect(assessment.runs[0]?.safeErrorCode).toBe("INVALID_RESULT");
    expect(assessment.suggestions).toEqual([]);
    expect(safeProcessingError("INVALID_RESULT").title).toBe("Review is not available");
    expect(safeProcessingError("PROCESSING_STUCK").title).toBe("Processing needs technical follow-up");
  });

  it("lets educators add any catalogue skill the model did not surface", () => {
    const state = createSanitizedPilotState();
    const assessment = processingAssessment();
    materializeCompletedRun(assessment, new Date("2026-07-13T14:00:02.000Z"));
    assessment.suggestions = assessment.suggestions.filter(
      (suggestion) => suggestion.sourceSkillId !== "help-2.18"
    );

    const projection = reviewProjection(state, assessment);

    expect(projection.availableSkills.map((skill) => skill.sourceSkillId)).toContain("help-2.18");
    expect(projection.availableSkills.map((skill) => skill.sourceSkillId)).not.toContain("help-1.52");
  });

  it("resolves exactly one authoritative next route for each state", () => {
    const state = createSanitizedPilotState();
    const base = processingAssessment();
    const expectations = [
      ["DRAFT", `/assessments/new?childId=${base.childId}&assessmentId=${base.id}`, "Start processing"],
      ["PROCESSING", `/assessments/${base.id}/processing`, "View status"],
      ["READY_FOR_REVIEW", `/assessments/${base.id}/review`, "Start review"],
      ["IN_REVIEW", `/assessments/${base.id}/review`, "Continue review"],
      ["FINALIZED", `/assessments/${base.id}/final`, "View final"],
      ["FAILED", `/assessments/${base.id}/processing`, "Review failure"]
    ] as const;

    expect(state.children[0]?.id).toBe(base.childId);
    for (const [status, destination, label] of expectations) {
      const assessment = { ...base, status };
      expect(assessmentDestination(assessment)).toBe(destination);
      expect(assessmentActionLabel(assessment)).toBe(label);
    }
  });

  it("replays a draft-creation key after the assessment advances", () => {
    const state = createSanitizedPilotState();
    const assessment = {
      ...processingAssessment(),
      status: "READY_FOR_REVIEW" as const,
      clientRequestId: "11111111-1111-4111-8111-111111111111"
    };
    state.assessments.push(assessment);

    expect(
      findExistingAssessmentForCreate(
        state,
        assessment.educatorId,
        assessment.childId,
        assessment.observationDate,
        assessment.clientRequestId
      )
    ).toBe(assessment);
  });
});
