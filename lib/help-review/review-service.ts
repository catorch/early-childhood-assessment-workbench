import { randomUUID } from "node:crypto";

import type { NextRequest } from "next/server";

import {
  deriveDecisionOrigin,
  deriveReviewSummary,
  findSequentialCreditConflicts,
  type PrimaryCredit,
  type ReviewDecisionMutation,
  type SkillSuggestion
} from "./domain";
import { configuredHelpCatalog } from "./help-catalog";
import { issuePlaybackGrant, playbackUrl, validatePlaybackGrant } from "./playback-grants";
import { activeUserFromState } from "./server-auth";
import { recordSupportEvent } from "./server-events";
import { readPilotState, updatePilotState } from "./server-store";
import { requireAssessment, reviewProjection as buildReviewProjection } from "./server-workflow";

export interface ManualSkillCommand {
  readonly sourceSkillId: string;
  readonly finalCredit: PrimaryCredit;
  readonly concernFlag?: boolean;
  readonly note: string | null;
}

export interface ReviewServiceDependencies {
  readonly readState: typeof readPilotState;
  readonly updateState: typeof updatePilotState;
}

const defaultDependencies: ReviewServiceDependencies = {
  readState: readPilotState,
  updateState: updatePilotState
};

const sensoryAtypicalCredits: readonly PrimaryCredit[] = [
  "ATYPICAL_PLUS",
  "ATYPICAL_MINUS",
  "ATYPICAL_EMERGING"
];

export function invalidAtypicalCredit(
  domain: string,
  credit: PrimaryCredit | null,
  sensoryCreditKeys: readonly ("A_PLUS" | "A_MINUS" | "A_EMERGING")[] = []
): string | null {
  const sensorySection = /^\s*0\.0\b/.test(domain) || /regulatory|sensory/i.test(domain);
  if (sensorySection && credit === "ATYPICAL") {
    return "Regulatory/sensory skills require A+, A-, or A+/- instead of standard Atypical.";
  }
  if (!sensorySection && credit !== null && sensoryAtypicalCredits.includes(credit)) {
    return "A+, A-, and A+/- are reserved for the regulatory/sensory section.";
  }
  if (sensorySection && credit !== null && sensoryAtypicalCredits.includes(credit) && sensoryCreditKeys.length > 0) {
    const creditKey: "A_PLUS" | "A_MINUS" | "A_EMERGING" = credit === "ATYPICAL_PLUS"
      ? "A_PLUS"
      : credit === "ATYPICAL_MINUS"
        ? "A_MINUS"
        : "A_EMERGING";
    if (!sensoryCreditKeys.includes(creditKey)) {
      return "Choose the atypical variant defined for this regulatory/sensory skill.";
    }
  }
  return null;
}

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
        if (mutation.finalCredit === "BLANK" && mutation.concernFlag) {
          return { conflict: "The O concern flag requires an underlying HELP credit." } as const;
        }
        const catalogSkill = configuredHelpCatalog().skills.find((candidate) => candidate.sourceSkillId === suggestion.sourceSkillId);
        const invalidCredit = invalidAtypicalCredit(suggestion.domain, mutation.finalCredit, catalogSkill?.sensoryCreditKeys);
        if (invalidCredit) return { conflict: invalidCredit } as const;
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
          origin: deriveDecisionOrigin(suggestion, mutation),
          finalCredit: mutation.finalCredit,
          dismissed: mutation.dismissed,
          concernFlag: mutation.concernFlag ?? false,
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

    /** Adds one catalogue skill the model never surfaced, together with its first decision, in one transaction. */
    async addManualSkill(request: NextRequest, assessmentId: string, command: ManualSkillCommand) {
      return dependencies.updateState((state) => {
        const actor = activeUserFromState(request, state);
        const assessment = requireAssessment(state, actor, assessmentId);
        if (assessment.status === "FINALIZED") return { conflict: "Final assessments are read-only." } as const;
        if (!["READY_FOR_REVIEW", "IN_REVIEW"].includes(assessment.status)) {
          return { conflict: "Assessment review is not ready." } as const;
        }
        const existing = assessment.suggestions.find(
          (candidate) => candidate.sourceSkillId === command.sourceSkillId
        );
        if (existing) {
          return {
            conflict: "This skill is already part of the review.",
            existingSuggestionId: existing.id
          } as const;
        }
        const skill = configuredHelpCatalog().skills.find(
          (candidate) => candidate.sourceSkillId === command.sourceSkillId
        );
        if (!skill) return { invalid: "The selected skill is not in the current catalogue." } as const;
        if (command.finalCredit === "BLANK" && command.concernFlag) {
          return { invalid: "The O concern flag requires an underlying HELP credit." } as const;
        }
        const invalidCredit = invalidAtypicalCredit(skill.domain, command.finalCredit, skill.sensoryCreditKeys);
        if (invalidCredit) return { invalid: invalidCredit } as const;
        const decidedAt = new Date().toISOString();
        const suggestion: SkillSuggestion = {
          id: `manual-${randomUUID()}`,
          sourceSkillId: skill.sourceSkillId,
          skillCode: skill.skillCode,
          skillName: skill.skillName,
          domain: skill.domain,
          strand: skill.strand ?? null,
          source: "EDUCATOR",
          draftCredit: null,
          confidence: null,
          uncertaintyReason: null,
          evidence: [],
          sourceOrder: skill.sourceOrder
        };
        const decision = {
          suggestionId: suggestion.id,
          educatorId: actor.id,
          origin: "MANUALLY_ADDED" as const,
          finalCredit: command.finalCredit,
          dismissed: false,
          concernFlag: command.concernFlag ?? false,
          note: command.note,
          revision: 1,
          decidedAt
        };
        assessment.suggestions.push(suggestion);
        assessment.decisions.push(decision);
        assessment.status = "IN_REVIEW";
        assessment.updatedAt = decidedAt;
        assessment.revision = (assessment.revision ?? 0) + 1;
        recordSupportEvent(state, {
          type: "DECISION_SAVED",
          actorId: actor.id,
          assessmentId: assessment.id,
          referenceId: suggestion.id,
          occurredAt: decidedAt
        });
        return {
          suggestion,
          decision,
          summary: deriveReviewSummary(assessment.suggestions, assessment.decisions)
        } as const;
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
        const sequenceConflicts = findSequentialCreditConflicts(assessment.suggestions, assessment.decisions);
        if (sequenceConflicts.length > 0) {
          return { finalized: false as const, remaining: 0, sequenceConflicts };
        }
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
