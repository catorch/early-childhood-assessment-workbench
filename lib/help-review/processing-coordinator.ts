import { createHash } from "node:crypto";

import {
  HELP_CATALOG_VERSION,
  SCORING_CONTRACT_VERSION,
  ScoringGatewayError,
  ScoringRequestSchema,
  validateScoringResultForRequest,
  type ScoringGateway
} from "./scoring-contract";
import { configuredHelpCatalog, selectScoringCandidates } from "./help-catalog";
import type { AssessmentContextSnapshot, PilotAssessment, PilotChild, PilotState } from "./models";
import { selectedScoringGateway } from "./scoring-gateway";
import { readPilotState, updatePilotState } from "./server-store";
import { selectedVideoStorage } from "./video-storage";
import type { VideoStorage } from "./video-storage";

const STUCK_AFTER_MS = 15 * 60 * 1000;
const RUN_LEASE_MS = 5 * 60 * 1000;

export function contextSnapshotForChild(
  child: PilotChild,
  capturedAt = new Date().toISOString()
): AssessmentContextSnapshot {
  const label = child.contextLabel?.toLowerCase() ?? "";
  const hasIfsp = /ifsp:\s*yes|\bifsp\b(?!:\s*no)/i.test(label);
  const hasDisability = /disabil/i.test(label);
  const inferredSupportContext = hasIfsp && hasDisability
    ? "IFSP_AND_DISABILITY"
    : hasIfsp
      ? "IFSP"
      : hasDisability
        ? "DISABILITY"
        : child.contextLabel === null || /:\s*no\b/i.test(label)
          ? "NONE_REPORTED"
          : "UNKNOWN";
  return {
    ageMonthsAtObservation: child.ageMonths,
    supportContext: child.supportContext ?? inferredSupportContext,
    contextLabel: child.contextLabel,
    processingAllowedAtCreation: child.processingAllowed,
    capturedAt,
    source: child.contextSource ?? "SANITIZED_ADMIN"
  };
}

export function markStuckRuns(state: PilotState, now = new Date()): number {
  let changed = 0;
  for (const assessment of state.assessments) {
    const run = assessment.runs.at(-1);
    if (!run || (run.status !== "RUNNING" && run.status !== "QUEUED")) continue;
    const startedAt = run.startedAt ?? run.requestedAt;
    if (now.getTime() - new Date(startedAt).getTime() < STUCK_AFTER_MS) continue;
    run.status = "FAILED";
    run.completedAt = now.toISOString();
    run.safeErrorCode = "PROCESSING_STUCK";
    assessment.status = "FAILED";
    assessment.updatedAt = now.toISOString();
    assessment.revision = (assessment.revision ?? 0) + 1;
    changed += 1;
  }
  return changed;
}

interface ClaimedRun {
  readonly assessmentId: string;
  readonly runId: string;
  readonly deliveryCount: number;
}

export interface ProcessingTriggerContext {
  readonly eventId?: string | null;
  readonly objectGeneration?: string | null;
  readonly retryDelivery?: boolean;
}

export type ProcessingDisposition =
  | "COMPLETED"
  | "FAILED"
  | "REQUEUED"
  | "ALREADY_HANDLED"
  | "IN_PROGRESS"
  | "NOT_FOUND"
  | "NOT_READY";

export class RetryableProcessingError extends Error {
  constructor(readonly safeCode: string) {
    super("Processing should be delivered again.");
  }
}

export interface ProcessingCoordinatorDependencies {
  readonly readState: typeof readPilotState;
  readonly updateState: typeof updatePilotState;
  readonly scoringGateway: ScoringGateway;
  readonly videoStorage: VideoStorage;
}

function defaultDependencies(): ProcessingCoordinatorDependencies {
  return {
    readState: readPilotState,
    updateState: updatePilotState,
    scoringGateway: selectedScoringGateway(),
    videoStorage: selectedVideoStorage()
  };
}

interface ClaimResult {
  readonly claim: ClaimedRun | null;
  readonly disposition: ProcessingDisposition;
}

async function claimRun(
  dependencies: ProcessingCoordinatorDependencies,
  requestedRunId?: string,
  trigger: ProcessingTriggerContext = {}
): Promise<ClaimResult> {
  return dependencies.updateState((state) => {
    if (!requestedRunId) markStuckRuns(state);
    for (const assessment of state.assessments) {
      const run = requestedRunId
        ? assessment.runs.find((candidate) => candidate.id === requestedRunId)
        : assessment.runs.at(-1);
      if (!run || (requestedRunId && run.id !== requestedRunId)) continue;
      if (assessment.runs.at(-1)?.id !== run.id) {
        return { claim: null, disposition: "ALREADY_HANDLED" as const };
      }
      if (run.status === "COMPLETED" || run.status === "FAILED") {
        return { claim: null, disposition: "ALREADY_HANDLED" as const };
      }
      if (run.status === "RUNNING") {
        const leaseAge = Date.now() - new Date(run.startedAt ?? run.requestedAt).getTime();
        if (leaseAge < RUN_LEASE_MS) {
          return { claim: null, disposition: "IN_PROGRESS" as const };
        }
        run.status = "QUEUED";
        run.startedAt = null;
      }
      if (run.status !== "QUEUED" || !assessment.video) {
        return { claim: null, disposition: "NOT_READY" as const };
      }
      if (assessment.runs.some((candidate) => candidate.id !== run.id && candidate.status === "RUNNING")) continue;
      if (assessment.decisions.length > 0) {
        const now = new Date().toISOString();
        run.status = "FAILED";
        run.completedAt = now;
        run.safeErrorCode = "RESULT_REPLACEMENT_BLOCKED";
        assessment.status = "FAILED";
        assessment.updatedAt = now;
        assessment.revision = (assessment.revision ?? 0) + 1;
        return { claim: null, disposition: "FAILED" as const };
      }
      const child = state.children.find((candidate) => candidate.id === assessment.childId && candidate.isActive);
      if (!child || !child.processingAllowed) {
        const now = new Date().toISOString();
        run.status = "FAILED";
        run.completedAt = now;
        run.safeErrorCode = "PROCESSING_NOT_ALLOWED";
        assessment.status = "FAILED";
        assessment.updatedAt = now;
        assessment.revision = (assessment.revision ?? 0) + 1;
        return { claim: null, disposition: "FAILED" as const };
      }
      const now = new Date().toISOString();
      run.status = "RUNNING";
      run.startedAt = now;
      run.scoringConfigurationReference = "pending";
      if (trigger.eventId) run.triggerEventId ??= trigger.eventId;
      if (trigger.objectGeneration) run.triggerObjectGeneration ??= trigger.objectGeneration;
      if (trigger.eventId || trigger.objectGeneration) {
        run.deliveryCount = (run.deliveryCount ?? 0) + 1;
        run.lastDispatchedAt = now;
      }
      assessment.status = "PROCESSING";
      assessment.updatedAt = now;
      return {
        claim: {
          assessmentId: assessment.id,
          runId: run.id,
          deliveryCount: run.deliveryCount ?? 0
        },
        disposition: "NOT_READY" as const
      };
    }
    return { claim: null, disposition: requestedRunId ? "NOT_FOUND" as const : "NOT_READY" as const };
  });
}

function findClaimed(state: PilotState, claim: ClaimedRun): { assessment: PilotAssessment; child: PilotChild } {
  const assessment = state.assessments.find((candidate) => candidate.id === claim.assessmentId);
  const child = state.children.find((candidate) => candidate.id === assessment?.childId);
  if (!assessment || !child || assessment.runs.at(-1)?.id !== claim.runId || !assessment.video) {
    throw new Error("The claimed processing run is no longer available.");
  }
  return { assessment, child };
}

async function executeClaim(
  claim: ClaimedRun,
  dependencies: ProcessingCoordinatorDependencies,
  trigger: ProcessingTriggerContext = {}
): Promise<ProcessingDisposition> {
  const outcomeStartedAt = Date.now();
  const state = await dependencies.readState();
  const { assessment, child } = findClaimed(state, claim);
  const run = assessment.runs.at(-1)!;
  const video = assessment.video!;
  const snapshot = assessment.contextSnapshot ?? contextSnapshotForChild(child, assessment.createdAt);
  const catalog = configuredHelpCatalog();
  const candidates = selectScoringCandidates(
    snapshot.ageMonthsAtObservation,
    snapshot.supportContext,
    catalog.skills,
    catalog
  );
  const request = ScoringRequestSchema.parse({
    contractVersion: assessment.scoringContractVersion ?? SCORING_CONTRACT_VERSION,
    runId: run.id,
    idempotencyKey: run.externalJobId,
    catalogVersion: assessment.contentCatalogVersion ?? HELP_CATALOG_VERSION,
    observation: {
      observationDate: assessment.observationDate,
      ageMonthsAtObservation: snapshot.ageMonthsAtObservation,
      supportContext: snapshot.supportContext
    },
    video: {
      videoAssetId: video.id,
      contentType: video.contentType,
      byteSize: video.byteSize,
      durationSeconds: video.durationSeconds ?? null,
      checksumSha256: video.checksumSha256 ?? null
    },
    rubric: {
      creditDefinitions: catalog.creditDefinitions,
      twoMinusRule: catalog.selectionPolicy.twoMinusRule
    },
    candidates
  });

  try {
    let media;
    try {
      media = await dependencies.videoStorage.readForScoring(video);
    } catch {
      throw new ScoringGatewayError("The private source video is unavailable.", "VIDEO_UNAVAILABLE", false);
    }
    if (video.checksumSha256 && media.kind === "bytes") {
      const actual = createHash("sha256").update(media.bytes).digest("hex");
      if (actual !== video.checksumSha256) {
        throw new ScoringGatewayError("The private source video failed integrity validation.", "VIDEO_UNAVAILABLE", false);
      }
    }
    const gatewayResult = await dependencies.scoringGateway.score(request, media);
    let result;
    try {
      result = validateScoringResultForRequest(request, gatewayResult);
    } catch {
      throw new ScoringGatewayError("The scoring response failed validation.", "INVALID_RESULT", false);
    }
    await dependencies.updateState((current) => {
      const currentAssessment = current.assessments.find((candidate) => candidate.id === claim.assessmentId);
      const currentRun = currentAssessment?.runs.at(-1);
      if (!currentAssessment || currentRun?.id !== claim.runId || currentRun.status !== "RUNNING") return;
      const now = new Date().toISOString();
      currentRun.completedAt = now;
      currentRun.scoringConfigurationReference = result.scoringConfigurationReference;
      if (result.outcome === "NO_VALID_RESULTS") {
        currentRun.status = "FAILED";
        currentRun.safeErrorCode = "INVALID_RESULT";
        currentAssessment.status = "FAILED";
        currentAssessment.suggestions = [];
      } else {
        currentRun.status = "COMPLETED";
        currentRun.safeErrorCode = null;
        currentAssessment.suggestions = [...result.suggestions];
        currentAssessment.decisions = [];
        currentAssessment.status = "READY_FOR_REVIEW";
      }
      currentAssessment.updatedAt = now;
      currentAssessment.revision = (currentAssessment.revision ?? 0) + 1;
    });
    console.info(JSON.stringify({
      event: "help_review_processing_outcome",
      runId: claim.runId,
      gateway: dependencies.scoringGateway.name,
      outcome: result.outcome === "VALID" ? "COMPLETED" : "NO_VALID_RESULTS",
      durationMs: Date.now() - outcomeStartedAt,
      retryable: false
    }));
    return result.outcome === "VALID" ? "COMPLETED" : "FAILED";
  } catch (error) {
    const safeCode = error instanceof ScoringGatewayError ? error.safeCode : "SCORING_UNAVAILABLE";
    const retryable = error instanceof ScoringGatewayError ? error.retryable : true;
    const configuredMaxDeliveries = Number(process.env.HELP_REVIEW_MAX_PROCESSING_DELIVERIES ?? 5);
    const maxDeliveries = Number.isInteger(configuredMaxDeliveries) && configuredMaxDeliveries > 0
      ? configuredMaxDeliveries
      : 5;
    const requeue = Boolean(trigger.retryDelivery && retryable && claim.deliveryCount < maxDeliveries);
    await dependencies.updateState((current) => {
      const currentAssessment = current.assessments.find((candidate) => candidate.id === claim.assessmentId);
      const currentRun = currentAssessment?.runs.at(-1);
      if (!currentAssessment || currentRun?.id !== claim.runId || currentRun.status !== "RUNNING") return;
      const now = new Date().toISOString();
      currentRun.status = requeue ? "QUEUED" : "FAILED";
      currentRun.startedAt = requeue ? null : currentRun.startedAt;
      currentRun.completedAt = requeue ? null : now;
      currentRun.safeErrorCode = safeCode;
      currentAssessment.status = requeue ? "PROCESSING" : "FAILED";
      currentAssessment.suggestions = [];
      currentAssessment.updatedAt = now;
      currentAssessment.revision = (currentAssessment.revision ?? 0) + 1;
    });
    console.info(JSON.stringify({
      event: "help_review_processing_outcome",
      runId: claim.runId,
      gateway: dependencies.scoringGateway.name,
      outcome: requeue ? "REQUEUED" : "FAILED",
      safeCode,
      durationMs: Date.now() - outcomeStartedAt,
      retryable
    }));
    if (requeue) throw new RetryableProcessingError(safeCode);
    return "FAILED";
  }
}

export async function processRunById(
  runId: string,
  trigger: ProcessingTriggerContext = {},
  suppliedDependencies?: ProcessingCoordinatorDependencies
): Promise<{ readonly processed: boolean; readonly disposition: ProcessingDisposition }> {
  const dependencies = suppliedDependencies ?? defaultDependencies();
  const claimed = await claimRun(dependencies, runId, trigger);
  if (!claimed.claim) return { processed: false, disposition: claimed.disposition };
  const disposition = await executeClaim(claimed.claim, dependencies, trigger);
  return { processed: true, disposition };
}

export async function processQueuedRuns(
  limit = 1,
  suppliedDependencies?: ProcessingCoordinatorDependencies
): Promise<{ processed: number }> {
  const dependencies = suppliedDependencies ?? defaultDependencies();
  let processed = 0;
  while (processed < limit) {
    const claimed = await claimRun(dependencies);
    if (!claimed.claim) break;
    await executeClaim(claimed.claim, dependencies);
    processed += 1;
  }
  return { processed };
}
