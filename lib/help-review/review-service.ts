import type { NextRequest } from "next/server";

import {
  deriveDecisionOrigin,
  deriveReviewSummary,
  type ReviewDecisionMutation
} from "./domain";
import { issuePlaybackGrant, playbackUrl, validatePlaybackGrant } from "./playback-grants";
import { activeUserFromState } from "./server-auth";
import { recordSupportEvent } from "./server-events";
import { readPilotState, updatePilotState } from "./server-store";
import { requireAssessment, reviewProjection as buildReviewProjection } from "./server-workflow";

export interface ReviewServiceDependencies {
  readonly readState: typeof readPilotState;
  readonly updateState: typeof updatePilotState;
}

const defaultDependencies: ReviewServiceDependencies = {
  readState: readPilotState,
  updateState: updatePilotState
};

export function createReviewService(dependencies: ReviewServiceDependencies = defaultDependencies) {
  return {
    async projection(request: NextRequest, assessmentId: string) {
      const projection = await dependencies.updateState((state) => {
        const actor = activeUserFromState(request, state);
        const assessment = requireAssessment(state, actor, assessmentId);
        if (!["READY_FOR_REVIEW", "IN_REVIEW", "FINALIZED"].includes(assessment.status)) return null;
        const grant = assessment.video ? issuePlaybackGrant(state, assessment, actor) : null;
        return buildReviewProjection(state, assessment, grant ? playbackUrl(assessment.id, grant.token) : undefined);
      });
      if (!projection) return { ok: false as const, status: 409 as const, body: { error: "Assessment review is not ready." } };
      if (projection.suggestions.length === 0) {
        return {
          ok: false as const,
          status: 422 as const,
          body: { code: "NO_VALID_RESULTS", error: "No complete validated suggestion set is available." }
        };
      }
      return { ok: true as const, projection };
    },

    async finalProjection(request: NextRequest, assessmentId: string) {
      const state = await dependencies.readState();
      const actor = activeUserFromState(request, state);
      const assessment = requireAssessment(state, actor, assessmentId);
      if (assessment.status !== "FINALIZED") {
        return { ok: false as const, status: 409 as const, body: { error: "The final assessment is not available." } };
      }
      return { ok: true as const, projection: buildReviewProjection(state, assessment) };
    },

    async playbackGrant(request: NextRequest, assessmentId: string) {
      return dependencies.updateState((state) => {
        const actor = activeUserFromState(request, state);
        const assessment = requireAssessment(state, actor, assessmentId);
        if (!assessment.video || !["READY_FOR_REVIEW", "IN_REVIEW"].includes(assessment.status)) return null;
        const grant = issuePlaybackGrant(state, assessment, actor);
        return { playbackUrl: playbackUrl(assessment.id, grant.token), expiresAt: grant.record.expiresAt };
      });
    },

    async authorizePlayback(
      request: NextRequest,
      assessmentId: string,
      token: string | null,
      range: string | null
    ) {
      return dependencies.updateState((state) => {
        const actor = activeUserFromState(request, state);
        const assessment = requireAssessment(state, actor, assessmentId);
        if (!assessment.video) return null;
        const grant = validatePlaybackGrant(state, token, {
          assessmentId: assessment.id,
          videoAssetId: assessment.video.id,
          viewerId: actor.id
        });
        if (!grant) return null;
        if (!range || range.startsWith("bytes=0-")) {
          recordSupportEvent(state, {
            type: "VIDEO_ACCESSED",
            actorId: actor.id,
            assessmentId: assessment.id,
            referenceId: assessment.video.id
          });
        }
        return assessment.video;
      });
    },

    async saveDecision(
      request: NextRequest,
      assessmentId: string,
      suggestionId: string,
      mutation: ReviewDecisionMutation
    ) {
      return dependencies.updateState((state) => {
        const actor = activeUserFromState(request, state);
        const assessment = requireAssessment(state, actor, assessmentId);
        if (assessment.status === "FINALIZED") return { conflict: "Final assessments are read-only." } as const;
        if (!["READY_FOR_REVIEW", "IN_REVIEW"].includes(assessment.status)) {
          return { conflict: "Assessment review is not ready." } as const;
        }
        const suggestion = assessment.suggestions.find((candidate) => candidate.id === suggestionId);
        if (!suggestion) return { conflict: "Review item is unavailable." } as const;
        const existingIndex = assessment.decisions.findIndex((decision) => decision.suggestionId === suggestionId);
        const existing = existingIndex >= 0 ? assessment.decisions[existingIndex] : null;
        const currentRevision = existing?.revision ?? 0;
        if (currentRevision !== mutation.expectedRevision) {
          return {
            conflict: "This item changed in another session. Choose which decision to keep.",
            currentDecision: existing,
            summary: deriveReviewSummary(assessment.suggestions, assessment.decisions)
          } as const;
        }
        const decidedAt = new Date().toISOString();
        const decision = {
          suggestionId,
          educatorId: actor.id,
          origin: deriveDecisionOrigin(suggestion.draftCredit, mutation),
          finalCredit: mutation.finalCredit,
          dismissed: mutation.dismissed,
          note: mutation.note,
          revision: currentRevision + 1,
          decidedAt
        };
        if (existingIndex >= 0) assessment.decisions[existingIndex] = decision;
        else assessment.decisions.push(decision);
        assessment.status = "IN_REVIEW";
        assessment.updatedAt = decidedAt;
        assessment.revision = (assessment.revision ?? 0) + 1;
        recordSupportEvent(state, {
          type: "DECISION_SAVED",
          actorId: actor.id,
          assessmentId: assessment.id,
          referenceId: suggestionId,
          occurredAt: decidedAt
        });
        return { decision, summary: deriveReviewSummary(assessment.suggestions, assessment.decisions) } as const;
      });
    },

    async finalize(
      request: NextRequest,
      assessmentId: string,
      command: { readonly expectedRevision: number; readonly requestId: string }
    ) {
      return dependencies.updateState((state) => {
        const actor = activeUserFromState(request, state);
        const assessment = requireAssessment(state, actor, assessmentId);
        if (assessment.status === "FINALIZED") {
          return { finalized: true as const, projection: buildReviewProjection(state, assessment) };
        }
        if ((assessment.revision ?? 0) !== command.expectedRevision) {
          return { finalized: false as const, remaining: 0, stale: true as const };
        }
        const summary = deriveReviewSummary(assessment.suggestions, assessment.decisions);
        if (summary.progress.total === 0) return { finalized: false as const, remaining: 0, invalid: true as const };
        if (summary.progress.remaining > 0) return { finalized: false as const, remaining: summary.progress.remaining };
        const finalizedAt = new Date().toISOString();
        assessment.status = "FINALIZED";
        assessment.finalizedAt = finalizedAt;
        assessment.finalizedById = actor.id;
        assessment.finalizationKey = command.requestId;
        assessment.updatedAt = finalizedAt;
        assessment.revision = (assessment.revision ?? 0) + 1;
        recordSupportEvent(state, {
          type: "ASSESSMENT_FINALIZED",
          actorId: actor.id,
          assessmentId: assessment.id,
          occurredAt: finalizedAt
        });
        return { finalized: true as const, projection: buildReviewProjection(state, assessment) };
      });
    }
  };
}

export const reviewService = createReviewService();
