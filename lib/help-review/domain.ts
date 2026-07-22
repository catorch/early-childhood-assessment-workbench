import { z } from "zod";

export const MODEL_DRAFT_CREDITS = ["PRESENT", "EMERGING", "NOT_OBSERVED"] as const;
export type ModelDraftCredit = (typeof MODEL_DRAFT_CREDITS)[number];
export const ModelDraftCreditSchema = z.enum(MODEL_DRAFT_CREDITS);

/** Credits an educator can save. BLANK is intentional and is not the same as unactioned. */
export const PRIMARY_CREDITS = [
  "PRESENT",
  "EMERGING",
  "NOT_OBSERVED",
  "BLANK",
  "NOT_APPLICABLE",
  "ATYPICAL",
  "ATYPICAL_PLUS",
  "ATYPICAL_MINUS",
  "ATYPICAL_EMERGING"
] as const;
export type PrimaryCredit = (typeof PRIMARY_CREDITS)[number];
export const PrimaryCreditSchema = z.enum(PRIMARY_CREDITS);

export const DECISION_ORIGINS = ["ACCEPTED", "OVERRIDDEN", "SCORED_INDEPENDENTLY", "MANUALLY_ADDED", "DISMISSED"] as const;
export type DecisionOrigin = (typeof DECISION_ORIGINS)[number];
export const DecisionOriginSchema = z.enum(DECISION_ORIGINS);

export const ASSESSMENT_STATUSES = [
  "DRAFT",
  "UPLOADING",
  "PROCESSING",
  "READY_FOR_REVIEW",
  "IN_REVIEW",
  "FINALIZED",
  "FAILED"
] as const;
export type AssessmentStatus = (typeof ASSESSMENT_STATUSES)[number];
export const AssessmentStatusSchema = z.enum(ASSESSMENT_STATUSES);

export const ReviewDecisionMutationSchema = z
  .object({
    expectedRevision: z.number().int().nonnegative(),
    finalCredit: PrimaryCreditSchema.nullable(),
    dismissed: z.boolean(),
    concernFlag: z.boolean().default(false),
    note: z.string().trim().max(1_000).nullable()
  })
  .strict()
  .superRefine((value, context) => {
    const dismissedWithCredit = value.dismissed && value.finalCredit !== null;
    const includedWithoutCredit = !value.dismissed && value.finalCredit === null;

    if (dismissedWithCredit || includedWithoutCredit) {
      context.addIssue({
        code: "custom",
        path: ["finalCredit"],
        message: "Dismissed suggestions have no credit; included suggestions require one."
      });
    }
    if (value.dismissed && value.concernFlag) {
      context.addIssue({
        code: "custom",
        path: ["concernFlag"],
        message: "A dismissed suggestion cannot carry the family/environment concern flag."
      });
    }
    if (value.finalCredit === "BLANK" && value.concernFlag) {
      context.addIssue({
        code: "custom",
        path: ["concernFlag"],
        message: "The O concern flag requires an underlying HELP credit."
      });
    }
  });

export type ReviewDecisionMutation = z.input<typeof ReviewDecisionMutationSchema>;

export const EvidenceSchema = z
  .object({
    timestampSeconds: z.number().int().nonnegative(),
    endTimestampSeconds: z.number().int().nonnegative().optional(),
    explanation: z.string().trim().min(1).max(2_000)
  })
  .strict()
  .superRefine((value, context) => {
    if (value.endTimestampSeconds !== undefined && value.endTimestampSeconds < value.timestampSeconds) {
      context.addIssue({
        code: "custom",
        path: ["endTimestampSeconds"],
        message: "Evidence end time cannot be earlier than its start time."
      });
    }
  });
export type Evidence = z.infer<typeof EvidenceSchema>;

export const SUGGESTION_SOURCES = ["MODEL", "EDUCATOR"] as const;
export type SuggestionSource = (typeof SUGGESTION_SOURCES)[number];

export const SkillSuggestionSchema = z
  .object({
    id: z.string().min(1),
    sourceSkillId: z.string().min(1),
    skillCode: z.string().min(1),
    skillName: z.string().min(1),
    domain: z.string().min(1),
    strand: z.string().min(1).nullable(),
    source: z.enum(SUGGESTION_SOURCES).default("MODEL"),
    draftCredit: ModelDraftCreditSchema.nullable(),
    confidence: z.number().min(0).max(1).nullable(),
    uncertaintyReason: z.string().min(1).nullable(),
    evidence: z.array(EvidenceSchema),
    sourceOrder: z.number().int().nonnegative()
  })
  .strict()
  .superRefine((value, context) => {
    if (value.source === "MODEL" && value.evidence.length === 0) {
      context.addIssue({
        code: "custom",
        path: ["evidence"],
        message: "A model suggestion requires at least one evidence entry."
      });
    }
    if (value.source === "MODEL" && value.draftCredit === null && value.uncertaintyReason === null) {
      context.addIssue({
        code: "custom",
        path: ["uncertaintyReason"],
        message: "An unscored suggestion requires an uncertainty reason."
      });
    }
    if (value.source === "EDUCATOR" && value.draftCredit !== null) {
      context.addIssue({
        code: "custom",
        path: ["draftCredit"],
        message: "An educator-added skill has no model draft credit."
      });
    }
  });
export type SkillSuggestion = z.infer<typeof SkillSuggestionSchema>;

export interface SavedReviewDecision {
  readonly suggestionId: string;
  readonly educatorId: string;
  readonly origin: DecisionOrigin;
  readonly finalCredit: PrimaryCredit | null;
  readonly dismissed: boolean;
  readonly concernFlag?: boolean;
  readonly note: string | null;
  readonly revision: number;
  readonly decidedAt: string;
}

export interface ReviewProgress {
  readonly total: number;
  readonly actioned: number;
  readonly remaining: number;
  readonly percent: number;
}

export interface ReviewSummary {
  readonly progress: ReviewProgress;
  readonly origins: Readonly<Record<DecisionOrigin, number>>;
  readonly credits: Readonly<Record<PrimaryCredit, number>>;
  readonly concernFlags: number;
  readonly coverage: {
    readonly developmentalDomainCount: number;
    readonly strandCount: number;
    readonly skillCount: number;
    readonly regulatorySensorySkillCount: number;
  };
  readonly domains: ReadonlyArray<{
    readonly domain: string;
    readonly credits: Readonly<Record<PrimaryCredit, number>>;
  }>;
  readonly included: ReadonlyArray<{
    readonly suggestion: SkillSuggestion;
    readonly decision: SavedReviewDecision;
  }>;
  readonly dismissed: ReadonlyArray<{
    readonly suggestion: SkillSuggestion;
    readonly decision: SavedReviewDecision;
  }>;
}

export function deriveDecisionOrigin(
  suggestion: Pick<SkillSuggestion, "draftCredit" | "source">,
  mutation: ReviewDecisionMutation
): DecisionOrigin {
  if (mutation.dismissed) return "DISMISSED";
  if (suggestion.source === "EDUCATOR") return "MANUALLY_ADDED";
  if (suggestion.draftCredit === null) return "SCORED_INDEPENDENTLY";
  return mutation.finalCredit === suggestion.draftCredit ? "ACCEPTED" : "OVERRIDDEN";
}

function emptyCreditCounts(): Record<PrimaryCredit, number> {
  return {
    PRESENT: 0,
    EMERGING: 0,
    NOT_OBSERVED: 0,
    BLANK: 0,
    NOT_APPLICABLE: 0,
    ATYPICAL: 0,
    ATYPICAL_PLUS: 0,
    ATYPICAL_MINUS: 0,
    ATYPICAL_EMERGING: 0
  };
}

function domainCoverageKey(domain: string): { key: string; regulatorySensory: boolean } {
  const code = domain.match(/^\s*(\d+\.0)\b/)?.[1];
  if (code) return { key: code, regulatorySensory: code === "0.0" };
  const normalized = domain.trim().toLowerCase();
  if (normalized.includes("regulatory") || normalized.includes("sensory")) {
    return { key: "0.0", regulatorySensory: true };
  }
  if (normalized.includes("language")) return { key: "2.0", regulatorySensory: false };
  if (normalized.includes("fine motor")) return { key: "4.0", regulatorySensory: false };
  return { key: normalized, regulatorySensory: false };
}

export interface SequenceConflict {
  readonly earlier: SkillSuggestion;
  readonly later: SkillSuggestion;
}

/** Detects the confirmed impossible pattern: an earlier minus followed by a later plus in one strand. */
export function findSequentialCreditConflicts(
  suggestions: readonly SkillSuggestion[],
  decisions: readonly SavedReviewDecision[]
): readonly SequenceConflict[] {
  const decisionBySuggestion = new Map(decisions.map((decision) => [decision.suggestionId, decision]));
  const byStrand = new Map<string, SkillSuggestion[]>();
  for (const suggestion of suggestions) {
    const decision = decisionBySuggestion.get(suggestion.id);
    if (!suggestion.strand || !decision || decision.dismissed) continue;
    const key = `${domainCoverageKey(suggestion.domain).key}\u0000${suggestion.strand.trim().toLowerCase()}`;
    byStrand.set(key, [...(byStrand.get(key) ?? []), suggestion]);
  }

  const conflicts: SequenceConflict[] = [];
  for (const strandSuggestions of byStrand.values()) {
    const ordered = [...strandSuggestions].sort((left, right) => left.sourceOrder - right.sourceOrder);
    for (let laterIndex = 0; laterIndex < ordered.length; laterIndex += 1) {
      const later = ordered[laterIndex]!;
      if (decisionBySuggestion.get(later.id)?.finalCredit !== "PRESENT") continue;
      const earlier = ordered
        .slice(0, laterIndex)
        .find((candidate) => decisionBySuggestion.get(candidate.id)?.finalCredit === "NOT_OBSERVED");
      if (earlier) conflicts.push({ earlier, later });
    }
  }
  return conflicts;
}

/** Derives review progress and final totals only from saved decisions. */
export function deriveReviewSummary(
  suggestions: readonly SkillSuggestion[],
  decisions: readonly SavedReviewDecision[]
): ReviewSummary {
  const suggestionIds = new Set(suggestions.map((suggestion) => suggestion.id));
  const decisionBySuggestion = new Map<string, SavedReviewDecision>();

  for (const decision of decisions) {
    if (!suggestionIds.has(decision.suggestionId)) {
      throw new Error(`Decision references unknown suggestion: ${decision.suggestionId}`);
    }
    if (decisionBySuggestion.has(decision.suggestionId)) {
      throw new Error(`Duplicate decision for suggestion: ${decision.suggestionId}`);
    }
    decisionBySuggestion.set(decision.suggestionId, decision);
  }

  const origins: Record<DecisionOrigin, number> = {
    ACCEPTED: 0,
    OVERRIDDEN: 0,
    SCORED_INDEPENDENTLY: 0,
    MANUALLY_ADDED: 0,
    DISMISSED: 0
  };
  const credits = emptyCreditCounts();
  const domainCounts = new Map<string, Record<PrimaryCredit, number>>();
  const included: ReviewSummary["included"][number][] = [];
  const dismissed: ReviewSummary["dismissed"][number][] = [];
  let concernFlags = 0;

  for (const suggestion of suggestions) {
    const decision = decisionBySuggestion.get(suggestion.id);
    if (!decision) continue;
    origins[decision.origin] += 1;
    if (decision.dismissed) {
      dismissed.push({ suggestion, decision });
      continue;
    }
    if (decision.finalCredit === null) {
      throw new Error(`Included decision has no final credit: ${decision.suggestionId}`);
    }
    credits[decision.finalCredit] += 1;
    if (decision.concernFlag) concernFlags += 1;
    const currentDomainCounts = domainCounts.get(suggestion.domain) ?? emptyCreditCounts();
    currentDomainCounts[decision.finalCredit] += 1;
    domainCounts.set(suggestion.domain, currentDomainCounts);
    included.push({ suggestion, decision });
  }

  const actioned = decisions.length;
  const total = suggestions.length;
  const developmentalDomains = new Set<string>();
  const strands = new Set<string>();
  let regulatorySensorySkillCount = 0;
  for (const { suggestion } of included) {
    const domain = domainCoverageKey(suggestion.domain);
    if (domain.regulatorySensory) regulatorySensorySkillCount += 1;
    else developmentalDomains.add(domain.key);
    if (suggestion.strand) strands.add(`${domain.key}\u0000${suggestion.strand.trim().toLowerCase()}`);
  }
  return {
    progress: {
      total,
      actioned,
      remaining: total - actioned,
      percent: total === 0 ? 0 : Math.round((actioned / total) * 100)
    },
    origins,
    credits,
    concernFlags,
    coverage: {
      developmentalDomainCount: developmentalDomains.size,
      strandCount: strands.size,
      skillCount: included.length,
      regulatorySensorySkillCount
    },
    domains: [...domainCounts.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([domain, domainCredits]) => ({ domain, credits: domainCredits })),
    included,
    dismissed
  };
}
