import { randomUUID } from "node:crypto";

import type { NextRequest } from "next/server";

import { deriveReviewSummary } from "./domain";
import { assessmentActionLabel, assessmentDestination } from "./presentation";
import { contextSnapshotForChild, markStuckRuns } from "./processing-coordinator";
import { clientProcessingRun } from "./public-projections";
import { configuredHelpCatalog } from "./help-catalog";
import { SCORING_CONTRACT_VERSION } from "./scoring-contract";
import { AccessError, activeUserFromState, requireChildAssignment } from "./server-auth";
import { recordSupportEvent } from "./server-events";
import { RequestError } from "./server-http";
import { readPilotState, updatePilotState } from "./server-store";
import { findExistingAssessmentForCreate, requireAssessment, safeProcessingError } from "./server-workflow";

export interface AssessmentCommand {
  readonly childId: string;
  readonly observationDate: string;
  readonly requestId: string;
}

export interface AssessmentQuery {
  readonly filter: "active" | "finalized" | "all";
  readonly search: string;
}

export interface AssessmentServiceDependencies {
  readonly readState: typeof readPilotState;
  readonly updateState: typeof updatePilotState;
}

const defaultDependencies: AssessmentServiceDependencies = {
  readState: readPilotState,
  updateState: updatePilotState
};

export function createAssessmentService(dependencies: AssessmentServiceDependencies = defaultDependencies) {
  return {
    async list(request: NextRequest, query: AssessmentQuery) {
      const state = await dependencies.readState();
      const actor = activeUserFromState(request, state);
      if (actor.role !== "EDUCATOR") throw new AccessError("The requested resource is unavailable.");
      const search = query.search.trim().toLowerCase();
      const assessments = state.assessments
        .filter((assessment) => assessment.educatorId === actor.id)
        .filter((assessment) => state.assignments.some((assignment) =>
          assignment.active && assignment.educatorId === actor.id && assignment.childId === assessment.childId))
        .filter((assessment) => query.filter === "all" ||
          (query.filter === "finalized" ? assessment.status === "FINALIZED" : assessment.status !== "FINALIZED"))
        .map((assessment) => {
          const child = state.children.find((candidate) => candidate.id === assessment.childId);
          if (!child) return null;
          const summary = assessment.suggestions.length > 0
            ? deriveReviewSummary(assessment.suggestions, assessment.decisions)
            : null;
          return {
            id: assessment.id,
            childId: child.id,
            childExternalId: child.externalChildId,
            childAgeMonths: child.ageMonths,
            observationDate: assessment.observationDate,
            status: assessment.status,
            updatedAt: assessment.updatedAt,
            progress: summary?.progress ?? null,
            actionHref: assessmentDestination(assessment),
            actionLabel: assessmentActionLabel(assessment)
          };
        })
        .filter((assessment): assessment is NonNullable<typeof assessment> => assessment !== null)
        .filter((assessment) => !search || assessment.childExternalId.toLowerCase().includes(search))
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
      return { assessments };
    },

    async create(request: NextRequest, command: AssessmentCommand) {
      return dependencies.updateState((state) => {
        const actor = activeUserFromState(request, state);
        if (actor.role !== "EDUCATOR") throw new AccessError("The requested resource is unavailable.");
        requireChildAssignment(state, actor.id, command.childId);
        const child = state.children.find((candidate) => candidate.id === command.childId && candidate.isActive);
        if (!child) throw new AccessError("The requested resource is unavailable.");
        if (!child.processingAllowed) {
          throw new RequestError("Processing permission is not approved for this child.", 409);
        }
        const replayedKey = state.assessments.find(
          (candidate) => candidate.educatorId === actor.id && candidate.clientRequestId === command.requestId
        );
        if (replayedKey && (replayedKey.childId !== child.id || replayedKey.observationDate !== command.observationDate)) {
          throw new RequestError("That request identifier was already used for a different assessment command.", 409);
        }
        const existing = findExistingAssessmentForCreate(
          state,
          actor.id,
          child.id,
          command.observationDate,
          command.requestId
        );
        if (existing) return existing;
        const now = new Date().toISOString();
        const assessment = {
          id: `assessment-${randomUUID()}`,
          childId: child.id,
          educatorId: actor.id,
          observationDate: command.observationDate,
          contextSnapshot: contextSnapshotForChild(child, now),
          contentCatalogVersion: configuredHelpCatalog().catalogVersion,
          scoringContractVersion: SCORING_CONTRACT_VERSION,
          status: "DRAFT" as const,
          video: null,
          runs: [],
          suggestions: [],
          decisions: [],
          finalizedAt: null,
          finalizedById: null,
          createdAt: now,
          updatedAt: now,
          revision: 0,
          clientRequestId: command.requestId,
          finalizationKey: null
        };
        state.assessments.push(assessment);
        return assessment;
      });
    },

    async startProcessing(request: NextRequest, assessmentId: string) {
      return dependencies.updateState((state) => {
        const actor = activeUserFromState(request, state);
        const assessment = state.assessments.find((candidate) => candidate.id === assessmentId);
        if (!assessment || actor.role !== "EDUCATOR" || assessment.educatorId !== actor.id) {
          throw new AccessError("The requested resource is unavailable.");
        }
        requireChildAssignment(state, actor.id, assessment.childId);
        const child = state.children.find((candidate) => candidate.id === assessment.childId && candidate.isActive);
        if (!child) throw new AccessError("The requested resource is unavailable.");
        if (!child.processingAllowed) {
          return { blocked: true as const, reason: "Processing permission is not approved for this child." };
        }
        if (!assessment.video) return { blocked: true as const, reason: "Upload a video before starting analysis." };
        const current = assessment.runs.at(-1);
        if (assessment.status === "PROCESSING" && current) return { blocked: false as const, run: current };
        if (!["DRAFT", "FAILED"].includes(assessment.status)) {
          return { blocked: true as const, reason: "This assessment cannot be submitted in its current state." };
        }
        const now = new Date();
        const retry = assessment.status === "FAILED";
        if (retry && current && !safeProcessingError(current.safeErrorCode).retryable) {
          return { blocked: true as const, reason: "This processing result requires correction before another attempt." };
        }
        const run = {
          id: `run-${randomUUID()}`,
          attempt: assessment.runs.length + 1,
          status: "QUEUED" as const,
          externalJobId: `sandbox-job-${randomUUID()}`,
          requestedAt: now.toISOString(),
          requestedById: actor.id,
          startedAt: null,
          readyAt: null,
          completedAt: null,
          safeErrorCode: null,
          scoringConfigurationReference: null,
          retryOfRunId: retry ? current?.id ?? null : null
        };
        assessment.runs.push(run);
        assessment.status = "PROCESSING";
        assessment.updatedAt = now.toISOString();
        assessment.revision = (assessment.revision ?? 0) + 1;
        if (retry) {
          recordSupportEvent(state, {
            type: "PROCESSING_RETRIED",
            actorId: actor.id,
            assessmentId: assessment.id,
            referenceId: run.id,
            occurredAt: now.toISOString()
          });
        }
        return { blocked: false as const, run };
      });
    },

    async processingStatus(request: NextRequest, assessmentId: string) {
      return dependencies.updateState((state) => {
        const actor = activeUserFromState(request, state);
        const assessment = requireAssessment(state, actor, assessmentId);
        markStuckRuns(state);
        const child = state.children.find((candidate) => candidate.id === assessment.childId);
        if (!child) throw new Error("Assessment child is unavailable.");
        const run = assessment.runs.at(-1) ?? null;
        return {
          id: assessment.id,
          observationDate: assessment.observationDate,
          status: assessment.status,
          updatedAt: assessment.updatedAt,
          child: { id: child.id, externalChildId: child.externalChildId },
          video: assessment.video
            ? { originalFilename: assessment.video.originalFilename, byteSize: assessment.video.byteSize }
            : null,
          run: run ? clientProcessingRun(run) : null,
          error: assessment.status === "FAILED" ? safeProcessingError(run?.safeErrorCode ?? null) : null,
          suggestionCount: assessment.suggestions.length,
          blankSuggestionCount: assessment.suggestions.filter((suggestion) => suggestion.draftCredit === null).length,
          ready: ["READY_FOR_REVIEW", "IN_REVIEW", "FINALIZED"].includes(assessment.status)
        };
      });
    }
  };
}

export const assessmentService = createAssessmentService();
