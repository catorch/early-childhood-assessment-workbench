/** Server-side assessment state transitions for the sanitized scoring adapter. */

import { createFakeScoringResult } from "./fake-scoring";
import { deriveReviewSummary } from "./domain";
import type { PilotAssessment, PilotState, PilotUser } from "./models";
import { AccessError, requireChildAssignment } from "./server-auth";

export function findExistingAssessmentForCreate(
  state: PilotState,
  educatorId: string,
  childId: string,
  observationDate: string,
  clientRequestId: string
): PilotAssessment | undefined {
  const repeatedRequest = state.assessments.find(
    (assessment) =>
      assessment.educatorId === educatorId && assessment.clientRequestId === clientRequestId
  );
  if (repeatedRequest) return repeatedRequest;
  return state.assessments.find(
    (assessment) =>
      assessment.educatorId === educatorId &&
      assessment.childId === childId &&
      assessment.observationDate === observationDate &&
      assessment.status === "DRAFT"
  );
}

export function requireAssessment(state: PilotState, actor: PilotUser, assessmentId: string): PilotAssessment {
  const assessment = state.assessments.find((candidate) => candidate.id === assessmentId);
  if (!assessment || actor.role !== "EDUCATOR" || assessment.educatorId !== actor.id) {
    throw new AccessError("The requested resource is unavailable.");
  }
  requireChildAssignment(state, actor.id, assessment.childId);
  return assessment;
}

export function materializeCompletedRun(assessment: PilotAssessment, now = new Date()): void {
  const run = assessment.runs.at(-1);
  if (!run || run.status === "COMPLETED" || run.status === "FAILED" || run.readyAt === null) return;
  if (new Date(run.readyAt) > now) {
    run.status = "RUNNING";
    return;
  }
  const filename = assessment.video?.originalFilename.toLowerCase() ?? "";
  if (filename.includes("fail-analysis") || filename.includes("invalid-result")) {
    run.status = "FAILED";
    run.completedAt = now.toISOString();
    run.safeErrorCode = filename.includes("invalid-result") ? "INVALID_RESULT" : "ANALYSIS_FAILED";
    assessment.status = "FAILED";
    assessment.updatedAt = now.toISOString();
    return;
  }
  run.status = "COMPLETED";
  run.completedAt = now.toISOString();
  assessment.suggestions = [...createFakeScoringResult(run.id)];
  assessment.status = "READY_FOR_REVIEW";
  assessment.updatedAt = now.toISOString();
}

export function reviewProjection(state: PilotState, assessment: PilotAssessment, playbackUrl?: string) {
  const child = state.children.find((candidate) => candidate.id === assessment.childId);
  if (!child) throw new Error(`Assessment ${assessment.id} references a missing child.`);
  return {
    assessment: {
      id: assessment.id,
      observationDate: assessment.observationDate,
      status: assessment.status,
      finalizedAt: assessment.finalizedAt,
      finalizedBy: state.users.find((candidate) => candidate.id === assessment.finalizedById)?.displayName ?? null,
      revision: assessment.revision ?? 0
    },
    child,
    video: assessment.video
      ? {
          id: assessment.video.id,
          originalFilename: assessment.video.originalFilename,
          contentType: assessment.video.contentType,
          playbackUrl: playbackUrl ?? `/api/assessments/${assessment.id}/video`
        }
      : null,
    suggestions: assessment.suggestions,
    decisions: assessment.decisions,
    summary: deriveReviewSummary(assessment.suggestions, assessment.decisions),
    features: { addOnFlags: false }
  };
}

export function safeProcessingError(errorCode: string | null): {
  readonly title: string;
  readonly description: string;
  readonly retryable: boolean;
} {
  if (errorCode === "INVALID_RESULT") {
    return {
      title: "Review is not available",
      description: "The analysis result could not be validated, so no partial draft was shown.",
      retryable: false
    };
  }
  if (errorCode === "PROCESSING_STUCK") {
    return {
      title: "Processing needs technical follow-up",
      description: "The processing attempt stopped updating. The private source video is still available for an authorized retry.",
      retryable: true
    };
  }
  if (errorCode === "VIDEO_UNAVAILABLE") {
    return {
      title: "The source video is unavailable",
      description: "The private video could not be verified. Replace it before starting a new analysis.",
      retryable: false
    };
  }
  if (errorCode === "SCORING_AUTHENTICATION_FAILED") {
    return {
      title: "Processing needs technical follow-up",
      description: "The scoring service configuration must be corrected before another attempt.",
      retryable: false
    };
  }
  if (errorCode === "RESULT_REPLACEMENT_BLOCKED") {
    return {
      title: "Existing review work was preserved",
      description: "A processing result was not applied because Educator review work already exists.",
      retryable: false
    };
  }
  return {
    title: "We could not complete the analysis",
    description: "Your video is still available. Retry processing or return to it later.",
    retryable: true
  };
}
