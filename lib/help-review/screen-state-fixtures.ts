import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";

import { deriveDecisionOrigin, type SavedReviewDecision, type SkillSuggestion } from "./domain";
import { createFakeScoringResult } from "./fake-scoring";
import { createSanitizedPilotState } from "./fixtures";
import type { PilotAssessment, PilotState, ProcessingRun, StoredVideo } from "./models";

export const SCREEN_IDS = Array.from({ length: 45 }, (_, index) => String(index + 1).padStart(2, "0"));
export const SCREEN_STRESS_SCENARIOS = ["long-skill", "dense-results", "long-email", "localized-label", "manual-add"] as const;
export type ScreenStressScenario = typeof SCREEN_STRESS_SCENARIOS[number];

interface VideoFixtureMetadata {
  readonly byteSize: number;
  readonly checksumSha256: string;
}

const fixedCreatedAt = "2026-07-14T13:00:00.000Z";
const fixedUpdatedAt = "2026-07-14T14:00:00.000Z";
const videoSlugs = ["upload-ready", "processing", "failed", "ready", "complete", "incomplete", "final", "no-results", "stuck"];

function activeRunRequestedAt(): string {
  return new Date().toISOString();
}

export async function ensureScreenFixtureVideos(): Promise<VideoFixtureMetadata> {
  const source = path.join(process.cwd(), "tests", "fixtures", "synthetic-observation.mp4");
  const bytes = await readFile(source);
  const destination = path.join(process.cwd(), ".data", "uploads");
  await mkdir(destination, { recursive: true });
  await Promise.all(videoSlugs.map((slug) => copyFile(source, path.join(destination, `screen-${slug}.mp4`))));
  return {
    byteSize: bytes.byteLength,
    checksumSha256: createHash("sha256").update(bytes).digest("hex")
  };
}

function video(slug: string, metadata: VideoFixtureMetadata): StoredVideo {
  return {
    id: `video-${slug}`,
    storageKey: `screen-${slug}.mp4`,
    originalFilename: "synthetic-observation.mp4",
    contentType: "video/mp4",
    byteSize: metadata.byteSize,
    durationSeconds: 3,
    checksumSha256: metadata.checksumSha256,
    uploadedAt: fixedCreatedAt,
    uploadedById: "user-educator-1"
  };
}

function run(
  slug: string,
  status: ProcessingRun["status"],
  requestedAt = fixedCreatedAt,
  safeErrorCode: string | null = null
): ProcessingRun {
  return {
    id: `run-${slug}`,
    attempt: 1,
    status,
    externalJobId: `job-${slug}`,
    requestedAt,
    requestedById: "user-educator-1",
    startedAt: status === "QUEUED" ? null : requestedAt,
    readyAt: null,
    completedAt: status === "COMPLETED" || status === "FAILED" ? fixedUpdatedAt : null,
    safeErrorCode,
    scoringConfigurationReference: status === "COMPLETED" ? "fake:sandbox-v1:help-2-provisional-2026-07" : null,
    retryOfRunId: null
  };
}

function decisionsFor(
  suggestions: readonly SkillSuggestion[],
  count = suggestions.length
): SavedReviewDecision[] {
  return suggestions.slice(0, count).map((suggestion, index) => {
    const finalCredit = suggestion.draftCredit ?? "PRESENT";
    const mutation = { expectedRevision: 0, finalCredit, dismissed: false, note: index === 0 ? "Sanitized educator context." : null };
    return {
      suggestionId: suggestion.id,
      educatorId: "user-educator-1",
      origin: deriveDecisionOrigin(suggestion, mutation),
      finalCredit,
      dismissed: false,
      note: mutation.note,
      revision: 1,
      decidedAt: fixedUpdatedAt
    };
  });
}

function assessment(
  slug: string,
  metadata: VideoFixtureMetadata,
  options: {
    readonly status: PilotAssessment["status"];
    readonly video?: StoredVideo | null;
    readonly runs?: ProcessingRun[];
    readonly suggestions?: SkillSuggestion[];
    readonly decisions?: SavedReviewDecision[];
    readonly childId?: string;
    readonly observationDate?: string;
    readonly ageMonthsAtObservation?: number;
    readonly finalized?: boolean;
  }
): PilotAssessment {
  const requestSuffix = createHash("sha256").update(slug).digest("hex").slice(0, 12);
  return {
    id: `assessment-${slug}`,
    childId: options.childId ?? "child-1001",
    educatorId: "user-educator-1",
    observationDate: options.observationDate ?? "2026-07-14",
    contextSnapshot: {
      ageMonthsAtObservation: options.ageMonthsAtObservation ?? (options.childId === "child-1024" ? 31 : 19),
      supportContext: "NONE_REPORTED",
      contextLabel: options.childId === "child-1024" ? null : "IFSP: No",
      processingAllowedAtCreation: true,
      capturedAt: fixedCreatedAt,
      source: "SANITIZED_ADMIN"
    },
    contentCatalogVersion: "help-2-provisional-2026-07",
    scoringContractVersion: "help-scoring-v0",
    status: options.status,
    video: options.video === undefined ? video(slug, metadata) : options.video,
    runs: options.runs ?? [],
    suggestions: options.suggestions ?? [],
    decisions: options.decisions ?? [],
    finalizedAt: options.finalized ? fixedUpdatedAt : null,
    finalizedById: options.finalized ? "user-educator-1" : null,
    createdAt: fixedCreatedAt,
    updatedAt: fixedUpdatedAt,
    revision: options.finalized ? 10 : 3,
    clientRequestId: `00000000-0000-4000-8000-${requestSuffix}`,
    finalizationKey: options.finalized ? `final-${slug}` : null
  };
}

function fitEvidenceToFixture(suggestion: SkillSuggestion): SkillSuggestion {
  const hasSupportingMoments = suggestion.evidence.length > 1;
  return {
    ...suggestion,
    evidence: suggestion.evidence.map((evidence, index) => ({
      ...evidence,
      timestampSeconds: Math.min(evidence.timestampSeconds, hasSupportingMoments ? index + 1 : 2),
      endTimestampSeconds: evidence.endTimestampSeconds === undefined ? undefined : 3
    }))
  };
}

/** Rich sanitized state shared by every accepted screen fixture. */
export function createScreenFixtureState(screenId: string, metadata: VideoFixtureMetadata): PilotState {
  if (!SCREEN_IDS.includes(screenId)) throw new Error(`Unknown accepted screen ID: ${screenId}`);
  const state = createSanitizedPilotState();
  const readySuggestions = [...createFakeScoringResult("run-ready")].map(fitEvidenceToFixture);
  const completeSuggestions = [...createFakeScoringResult("run-complete")].map(fitEvidenceToFixture);
  const incompleteSuggestions = [...createFakeScoringResult("run-incomplete")].map(fitEvidenceToFixture);
  const finalSuggestions = [...createFakeScoringResult("run-final")].map(fitEvidenceToFixture);

  state.assessments = [
    assessment("upload-ready", metadata, { status: "DRAFT", runs: [], suggestions: [], video: video("upload-ready", metadata), observationDate: "2026-07-07" }),
    assessment("processing", metadata, { status: "PROCESSING", runs: [run("processing", "RUNNING", activeRunRequestedAt())], observationDate: "2026-07-08" }),
    assessment("failed", metadata, { status: "FAILED", runs: [run("failed", "FAILED", fixedCreatedAt, "SCORING_UNAVAILABLE")], observationDate: "2026-07-09" }),
    assessment("ready", metadata, { status: "READY_FOR_REVIEW", runs: [run("ready", "COMPLETED")], suggestions: readySuggestions, observationDate: "2026-07-10" }),
    assessment("complete", metadata, { status: "IN_REVIEW", runs: [run("complete", "COMPLETED")], suggestions: completeSuggestions, decisions: decisionsFor(completeSuggestions), observationDate: "2026-07-11" }),
    assessment("incomplete", metadata, { status: "IN_REVIEW", runs: [run("incomplete", "COMPLETED")], suggestions: incompleteSuggestions, decisions: decisionsFor(incompleteSuggestions, 3), childId: "child-1024", observationDate: "2026-07-12" }),
    assessment("final", metadata, { status: "FINALIZED", runs: [run("final", "COMPLETED")], suggestions: finalSuggestions, decisions: decisionsFor(finalSuggestions), finalized: true, childId: "child-1024", observationDate: "2026-07-13" }),
    assessment("no-results", metadata, { status: "READY_FOR_REVIEW", runs: [run("no-results", "COMPLETED")], suggestions: [], observationDate: "2026-07-06" }),
    assessment("stuck", metadata, { status: "PROCESSING", runs: [run("stuck", "RUNNING", "2026-07-14T12:00:00.000Z")], childId: "child-1024", observationDate: "2026-07-05" })
  ];
  if (screenId === "14") {
    const firstProgressSuggestions = [...createFakeScoringResult("run-progress-first")].slice(0, 3);
    const latestProgressSuggestions = [...createFakeScoringResult("run-progress-latest")].slice(0, 2);
    const firstProgressDecisions = decisionsFor(firstProgressSuggestions).map((decision, index) => index === 0
      ? { ...decision, origin: "OVERRIDDEN" as const, finalCredit: "EMERGING" as const }
      : decision);
    state.assessments.push(
      assessment("progress-first", metadata, {
        status: "FINALIZED",
        runs: [run("progress-first", "COMPLETED")],
        suggestions: firstProgressSuggestions,
        decisions: firstProgressDecisions,
        observationDate: "2026-06-18",
        ageMonthsAtObservation: 18,
        finalized: true
      }),
      assessment("progress-latest", metadata, {
        status: "FINALIZED",
        runs: [run("progress-latest", "COMPLETED")],
        suggestions: latestProgressSuggestions,
        decisions: decisionsFor(latestProgressSuggestions),
        observationDate: "2026-07-02",
        ageMonthsAtObservation: 19,
        finalized: true
      })
    );
  }
  return state;
}

/** Applies non-production layout pressure without changing the accepted screen IDs. */
export function applyScreenStressScenario(state: PilotState, scenario: ScreenStressScenario): PilotState {
  if (scenario === "manual-add") {
    // Leave some catalogue skills unsuggested so the educator's add-skill path is exercisable.
    state.assessments = state.assessments.map((candidate) => candidate.id !== "assessment-ready"
      ? candidate
      : { ...candidate, suggestions: candidate.suggestions.slice(0, 5) });
  }
  if (scenario === "long-skill") {
    state.assessments = state.assessments.map((candidate) => candidate.id !== "assessment-ready"
      ? candidate
      : {
          ...candidate,
          suggestions: candidate.suggestions.map((suggestion, index) => index === 0
            ? {
                ...suggestion,
                skillName: "Coordinates several small objects while following a multi-step classroom direction without losing the original sequence",
                strand: "Fine motor planning and sustained classroom participation"
              }
            : suggestion)
        });
  }
  if (scenario === "dense-results") {
    state.assessments = state.assessments.map((candidate) => candidate.id !== "assessment-ready"
      ? candidate
      : {
          ...candidate,
          suggestions: Array.from({ length: 4 }, (_, group) => candidate.suggestions.map((suggestion, index) => ({
            ...suggestion,
            id: `${suggestion.id}-dense-${group + 1}`,
            sourceSkillId: `${suggestion.sourceSkillId}-dense-${group + 1}`,
            skillCode: `${group + 1}.${String(index + 1).padStart(2, "0")}`,
            sourceOrder: group * candidate.suggestions.length + index
          }))).flat(),
          decisions: []
        });
  }
  if (scenario === "long-email") {
    state.users = state.users.map((candidate) => candidate.id !== "user-educator-1"
      ? candidate
      : {
          ...candidate,
          displayName: "Alexandria Montgomery-Rivera",
          email: "alexandria.montgomery-rivera.early-intervention@example.test"
        });
    state.access = state.access.map((candidate) => candidate.userId !== "user-educator-1"
      ? candidate
      : { ...candidate, exactEmail: "alexandria.montgomery-rivera.early-intervention@example.test" });
  }
  if (scenario === "localized-label") {
    state.children = state.children.map((candidate) => candidate.id !== "child-1001"
      ? candidate
      : {
          ...candidate,
          externalChildId: "Participante infantil del programa 1001",
          contextLabel: "Plan individual de apoyo: sin cambios reportados"
        });
  }
  return state;
}
