import { randomUUID } from "node:crypto";

import type { NextRequest } from "next/server";

import type { PilotState, PilotUser, ProcessingRun } from "./models";
import { markStuckRuns } from "./processing-coordinator";
import { AccessError, activeUserFromState } from "./server-auth";
import { recordSupportEvent } from "./server-events";
import { updatePilotState } from "./server-store";
import { safeProcessingError } from "./server-workflow";

export type AdminJobFilter = "all" | "failed" | "stuck";

function safeAttempt(run: ProcessingRun) {
  return {
    id: run.id,
    attempt: run.attempt,
    status: run.status,
    requestedAt: run.requestedAt,
    startedAt: run.startedAt ?? null,
    completedAt: run.completedAt,
    safeErrorCode: run.safeErrorCode,
    retryOfRunId: run.retryOfRunId ?? null
  };
}

export function listAdminJobs(
  state: PilotState,
  options: { readonly filter: AdminJobFilter; readonly search: string; readonly now?: Date }
) {
  markStuckRuns(state, options.now);
  const needle = options.search.trim().toLowerCase();
  const allJobs = state.assessments.flatMap((assessment) => {
    const current = assessment.runs.at(-1);
    if (!current || current.status !== "FAILED") return [];
    const child = state.children.find((candidate) => candidate.id === assessment.childId);
    const stuck = current.safeErrorCode === "PROCESSING_STUCK";
    const activeAttempt = assessment.runs.some((run) => run.status === "QUEUED" || run.status === "RUNNING");
    const error = safeProcessingError(current.safeErrorCode);
    const retryEligible =
      assessment.status === "FAILED" &&
      assessment.video !== null &&
      child?.processingAllowed === true &&
      !activeAttempt &&
      assessment.decisions.length === 0 &&
      error.retryable;
    return [{
      assessmentId: assessment.id,
      observationDate: assessment.observationDate,
      childId: assessment.childId,
      childExternalId: child?.externalChildId ?? "Unavailable child",
      videoAvailable: assessment.video !== null,
      videoFilename: assessment.video?.originalFilename ?? null,
      retryEligible,
      retryReason: retryEligible
        ? null
        : assessment.video === null
          ? "The private source video is unavailable."
          : child?.processingAllowed !== true
            ? "Processing permission is not currently approved."
            : assessment.decisions.length > 0
              ? "Existing review work prevents result replacement."
              : !error.retryable
                ? "This failure requires a corrected input or service configuration before retry."
              : "Another attempt is active or the assessment state changed.",
      stuck,
      error,
      run: safeAttempt(current),
      attempts: assessment.runs.map(safeAttempt)
    }];
  }).sort((left, right) => right.run.requestedAt.localeCompare(left.run.requestedAt));

  return {
    jobs: allJobs.filter((job) => {
      if (options.filter === "failed" && job.stuck) return false;
      if (options.filter === "stuck" && !job.stuck) return false;
      return !needle ||
        job.childExternalId.toLowerCase().includes(needle) ||
        job.assessmentId.toLowerCase().includes(needle);
    }),
    totalRelevant: allJobs.length,
    lastRefreshedAt: (options.now ?? new Date()).toISOString()
  };
}

export function retryAdminProcessingRun(
  state: PilotState,
  actor: PilotUser,
  runId: string,
  now = new Date()
) {
  if (actor.role !== "ADMIN") throw new AccessError("The requested resource is unavailable.");
  markStuckRuns(state, now);
  const assessment = state.assessments.find((candidate) => candidate.runs.some((run) => run.id === runId));
  const failedRun = assessment?.runs.find((run) => run.id === runId);
  const child = assessment ? state.children.find((candidate) => candidate.id === assessment.childId) : null;
  const currentAttempt = assessment?.runs.at(-1);
  if (
    assessment?.status === "PROCESSING" &&
    currentAttempt?.retryOfRunId === runId &&
    (currentAttempt.status === "QUEUED" || currentAttempt.status === "RUNNING")
  ) {
    return { blocked: false as const, run: currentAttempt, replayed: true as const };
  }
  if (
    !assessment ||
    !failedRun ||
    failedRun.status !== "FAILED" ||
    assessment.runs.at(-1)?.id !== failedRun.id ||
    assessment.status !== "FAILED"
  ) {
    return { blocked: true as const, reason: "This processing run is no longer eligible for retry." };
  }
  if (
    !assessment.video ||
    child?.processingAllowed !== true ||
    assessment.decisions.length > 0 ||
    !safeProcessingError(failedRun.safeErrorCode).retryable
  ) {
    return { blocked: true as const, reason: "The source video, processing permission, or retry boundary is unavailable." };
  }
  const timestamp = now.toISOString();
  const run = {
    id: `run-${randomUUID()}`,
    attempt: Math.max(...assessment.runs.map((candidate) => candidate.attempt), 0) + 1,
    status: "QUEUED" as const,
    externalJobId: `job-${randomUUID()}`,
    requestedAt: timestamp,
    requestedById: actor.id,
    startedAt: null,
    readyAt: null,
    completedAt: null,
    safeErrorCode: null,
    scoringConfigurationReference: null,
    retryOfRunId: failedRun.id
  };
  assessment.runs.push(run);
  assessment.status = "PROCESSING";
  assessment.updatedAt = timestamp;
  assessment.revision = (assessment.revision ?? 0) + 1;
  recordSupportEvent(state, {
    type: "PROCESSING_RETRIED",
    actorId: actor.id,
    assessmentId: assessment.id,
    referenceId: run.id,
    occurredAt: timestamp
  });
  return { blocked: false as const, run, replayed: false as const };
}

export interface AdminJobsServiceDependencies {
  readonly updateState: typeof updatePilotState;
}

const defaultDependencies: AdminJobsServiceDependencies = {
  updateState: updatePilotState
};

export function createAdminJobsService(dependencies: AdminJobsServiceDependencies = defaultDependencies) {
  return {
    async projection(request: NextRequest, query: { readonly filter: AdminJobFilter; readonly search: string }) {
      return dependencies.updateState((state) => {
        const actor = activeUserFromState(request, state);
        if (actor.role !== "ADMIN") throw new AccessError("The requested resource is unavailable.");
        return listAdminJobs(state, query);
      });
    },

    async retry(request: NextRequest, runId: string) {
      return dependencies.updateState((state) => {
        const actor = activeUserFromState(request, state);
        return retryAdminProcessingRun(state, actor, runId);
      });
    }
  };
}

export const adminJobsService = createAdminJobsService();
