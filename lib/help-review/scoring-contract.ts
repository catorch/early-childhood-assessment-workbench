import { z } from "zod";

import { SkillSuggestionSchema } from "./domain";

export const SCORING_CONTRACT_VERSION = "help-scoring-v0" as const;
export const HELP_CATALOG_VERSION = process.env.HELP_REVIEW_HELP_CATALOG_VERSION ?? "help-2-provisional-2026-07";

export const SupportContextSchema = z.enum([
  "NONE_REPORTED",
  "IFSP",
  "DISABILITY",
  "IFSP_AND_DISABILITY",
  "UNKNOWN"
]);
export type SupportContext = z.infer<typeof SupportContextSchema>;

export const EvidenceModalitySchema = z.enum(["VISUAL", "AUDIO", "VISUAL_AND_AUDIO", "CONTEXT"]);
export type EvidenceModality = z.infer<typeof EvidenceModalitySchema>;

export const VideoScoreabilitySchema = z.enum([
  "DIRECT",
  "OPPORTUNITY_REQUIRED",
  "CONTEXT_DEPENDENT",
  "NOT_RELIABLY_SCOREABLE"
]);
export type VideoScoreability = z.infer<typeof VideoScoreabilitySchema>;

const CandidateCreditCriteriaSchema = z.object({
  present: z.string().trim().min(1).max(4_000),
  emerging: z.string().trim().min(1).max(4_000),
  notObserved: z.string().trim().min(1).max(4_000),
  notApplicable: z.string().trim().min(1).max(4_000)
}).strict();

export const ScoringCandidateSchema = z.object({
  sourceSkillId: z.string().trim().min(1).max(120),
  skillCode: z.string().trim().min(1).max(40),
  skillName: z.string().trim().min(1).max(500),
  domain: z.string().trim().min(1).max(120),
  strand: z.string().trim().min(1).max(120).nullable(),
  minimumAgeMonths: z.number().int().min(0).max(216),
  maximumAgeMonths: z.number().int().min(0).max(216),
  sourceOrder: z.number().int().nonnegative(),
  sourceFramework: z.string().trim().min(1).max(160).optional(),
  sourceReferenceUrl: z.url().max(1_000).optional(),
  sourceAgeMonths: z.number().int().min(0).max(216).optional(),
  videoScoreability: VideoScoreabilitySchema.optional(),
  observableDefinition: z.string().trim().min(1).max(4_000).optional(),
  observableIndicators: z.array(z.string().trim().min(1).max(1_000)).min(1).max(20).optional(),
  nonExamples: z.array(z.string().trim().min(1).max(1_000)).min(1).max(20).optional(),
  observationConditions: z.array(z.string().trim().min(1).max(1_000)).min(1).max(20).optional(),
  prohibitedInferences: z.array(z.string().trim().min(1).max(1_000)).min(1).max(20).optional(),
  evidenceModalities: z.array(EvidenceModalitySchema).min(1).max(4).optional(),
  creditCriteria: CandidateCreditCriteriaSchema.optional()
}).strict().superRefine((candidate, context) => {
  if (candidate.maximumAgeMonths < candidate.minimumAgeMonths) {
    context.addIssue({
      code: "custom",
      path: ["maximumAgeMonths"],
      message: "A candidate maximum age cannot be lower than its minimum age."
    });
  }
});
export type ScoringCandidate = z.infer<typeof ScoringCandidateSchema>;

const ScoringCreditDefinitionSchema = z.object({
  value: z.enum(["PRESENT", "EMERGING", "NOT_OBSERVED", "NOT_APPLICABLE"]),
  symbol: z.string().trim().min(1).max(8),
  label: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(2_000)
}).strict();

export const ScoringRubricSchema = z.object({
  creditDefinitions: z.array(ScoringCreditDefinitionSchema).length(4),
  twoMinusRule: z.object({
    enabled: z.boolean(),
    consecutiveNotObserved: z.number().int().min(1).max(10),
    decisionReference: z.string().trim().min(1).max(500)
  }).strict()
}).strict().superRefine((rubric, context) => {
  const expected = new Set(["PRESENT", "EMERGING", "NOT_OBSERVED", "NOT_APPLICABLE"]);
  const actual = new Set(rubric.creditDefinitions.map((definition) => definition.value));
  if (actual.size !== expected.size || [...expected].some((credit) => !actual.has(credit as never))) {
    context.addIssue({
      code: "custom",
      path: ["creditDefinitions"],
      message: "The scoring rubric must define every supported credit exactly once."
    });
  }
});
export type ScoringRubric = z.infer<typeof ScoringRubricSchema>;

export const ScoringRequestSchema = z.object({
  contractVersion: z.literal(SCORING_CONTRACT_VERSION),
  runId: z.string().trim().min(1).max(160),
  idempotencyKey: z.string().trim().min(1).max(200),
  catalogVersion: z.literal(HELP_CATALOG_VERSION),
  observation: z.object({
    observationDate: z.iso.date(),
    ageMonthsAtObservation: z.number().int().min(0).max(216),
    supportContext: SupportContextSchema
  }).strict(),
  video: z.object({
    videoAssetId: z.string().trim().min(1).max(160),
    contentType: z.enum(["video/mp4", "video/webm", "video/quicktime"]),
    byteSize: z.number().int().positive().max(100 * 1024 * 1024),
    durationSeconds: z.number().int().positive().max(5 * 60).nullable(),
    checksumSha256: z.string().regex(/^[a-f0-9]{64}$/).nullable()
  }).strict(),
  rubric: ScoringRubricSchema.optional(),
  candidates: z.array(ScoringCandidateSchema).min(1).max(500)
}).strict().superRefine((request, context) => {
  const skillIds = new Set<string>();
  const orders = new Set<number>();
  for (const candidate of request.candidates) {
    if (skillIds.has(candidate.sourceSkillId) || orders.has(candidate.sourceOrder)) {
      context.addIssue({
        code: "custom",
        path: ["candidates"],
        message: "Candidate skill identifiers and source order must be unique."
      });
      return;
    }
    skillIds.add(candidate.sourceSkillId);
    orders.add(candidate.sourceOrder);
  }
});
export type ScoringRequest = z.infer<typeof ScoringRequestSchema>;

export const ScoringResultSchema = z.object({
  contractVersion: z.literal(SCORING_CONTRACT_VERSION),
  runId: z.string().trim().min(1).max(160),
  outcome: z.enum(["VALID", "NO_VALID_RESULTS"]),
  scoringConfigurationReference: z.string().trim().min(1).max(500),
  suggestions: z.array(SkillSuggestionSchema).max(500)
}).strict().superRefine((result, context) => {
  if (result.outcome === "VALID" && result.suggestions.length === 0) {
    context.addIssue({
      code: "custom",
      path: ["suggestions"],
      message: "A valid scoring result must include at least one suggestion."
    });
  }
  if (result.outcome === "NO_VALID_RESULTS" && result.suggestions.length !== 0) {
    context.addIssue({
      code: "custom",
      path: ["suggestions"],
      message: "A no-valid-results response cannot include partial suggestions."
    });
  }

  const ids = new Set<string>();
  const sourceSkillIds = new Set<string>();
  const sourceOrders = new Set<number>();
  for (const suggestion of result.suggestions) {
    if (
      ids.has(suggestion.id) ||
      sourceSkillIds.has(suggestion.sourceSkillId) ||
      sourceOrders.has(suggestion.sourceOrder)
    ) {
      context.addIssue({
        code: "custom",
        path: ["suggestions"],
        message: "Suggestion identifiers and source order must be unique."
      });
      return;
    }
    ids.add(suggestion.id);
    sourceSkillIds.add(suggestion.sourceSkillId);
    sourceOrders.add(suggestion.sourceOrder);
  }
});
export type ScoringResult = z.infer<typeof ScoringResultSchema>;

const MAX_RESULT_BYTES = 1 * 1024 * 1024;

/** Cross-validates a result against the exact immutable request that produced it. */
export function validateScoringResultForRequest(
  unparsedRequest: ScoringRequest,
  unparsedResult: ScoringResult
): ScoringResult {
  const request = ScoringRequestSchema.parse(unparsedRequest);
  if (Buffer.byteLength(JSON.stringify(unparsedResult), "utf8") > MAX_RESULT_BYTES) {
    throw new Error("The scoring result exceeds the accepted payload limit.");
  }
  const result = ScoringResultSchema.parse(unparsedResult);
  if (result.runId !== request.runId || result.contractVersion !== request.contractVersion) {
    throw new Error("The scoring result does not match its request identity.");
  }
  const candidates = new Map(request.candidates.map((candidate) => [candidate.sourceSkillId, candidate]));
  for (const suggestion of result.suggestions) {
    const candidate = candidates.get(suggestion.sourceSkillId);
    if (
      !candidate ||
      suggestion.skillCode !== candidate.skillCode ||
      suggestion.skillName !== candidate.skillName ||
      suggestion.domain !== candidate.domain ||
      suggestion.strand !== candidate.strand ||
      suggestion.sourceOrder !== candidate.sourceOrder
    ) {
      throw new Error("The scoring result contains a skill outside the exact candidate contract.");
    }
    const maximumEvidenceSecond = request.video.durationSeconds ?? 5 * 60;
    if (suggestion.evidence.some((evidence) =>
      evidence.timestampSeconds > maximumEvidenceSecond ||
      (evidence.endTimestampSeconds ?? evidence.timestampSeconds) > maximumEvidenceSecond
    )) {
      throw new Error("The scoring result contains evidence outside the observation duration.");
    }
  }
  return result;
}

export type ScoringFailureCode =
  | "SCORING_AUTHENTICATION_FAILED"
  | "SCORING_RATE_LIMITED"
  | "SCORING_TIMEOUT"
  | "SCORING_UNAVAILABLE"
  | "INVALID_RESULT"
  | "VIDEO_UNAVAILABLE";

export class ScoringGatewayError extends Error {
  constructor(
    message: string,
    readonly safeCode: ScoringFailureCode,
    readonly retryable: boolean
  ) {
    super(message);
  }
}

export type ScoringMedia =
  | {
      readonly kind: "bytes";
      readonly bytes: Uint8Array;
      readonly contentType: "video/mp4" | "video/webm" | "video/quicktime";
    }
  | {
      readonly kind: "gcs";
      readonly uri: `gs://${string}`;
      readonly contentType: "video/mp4" | "video/webm" | "video/quicktime";
      readonly generation?: string | null;
    };

export interface ScoringGateway {
  readonly name: string;
  score(request: ScoringRequest, media: ScoringMedia): Promise<ScoringResult>;
}
