/** Server-side assessment state transitions for the sanitized scoring adapter. */

import { createFakeScoringResult } from "./fake-scoring";
import { deriveReviewSummary } from "./domain";
import type { PilotAssessment, PilotState, PilotUser } from "./models";
import { AccessError, requireChildAssignment } from "./server-auth";

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

export function reviewProjection(state: PilotState, assessment: PilotAssessment) {
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
          playbackUrl: `/api/assessments/${assessment.id}/video`
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
      retryable: true
    };
  }
  if (errorCode === "PROCESSING_STUCK") {
    return {
      title: "Processing needs technical follow-up",
      description: "The processing attempt stopped updating. The private source video is still available for an authorized retry.",
      retryable: true
    };
  }
  return {
    title: "We could not complete the analysis",
    description: "Your video is still available. Retry processing or return to it later.",
    retryable: true
  };
}
