import { z } from "zod";

export const PRIMARY_CREDITS = ["PRESENT", "EMERGING", "NOT_OBSERVED", "NOT_APPLICABLE"] as const;
export type PrimaryCredit = (typeof PRIMARY_CREDITS)[number];
export const PrimaryCreditSchema = z.enum(PRIMARY_CREDITS);

export const DECISION_ORIGINS = ["ACCEPTED", "OVERRIDDEN", "SCORED_INDEPENDENTLY", "DISMISSED"] as const;
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
  });

export type ReviewDecisionMutation = z.infer<typeof ReviewDecisionMutationSchema>;

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

export const SkillSuggestionSchema = z
  .object({
    id: z.string().min(1),
    sourceSkillId: z.string().min(1),
    skillCode: z.string().min(1),
    skillName: z.string().min(1),
    domain: z.string().min(1),
    strand: z.string().min(1).nullable(),
    draftCredit: PrimaryCreditSchema.nullable(),
    confidence: z.number().min(0).max(1).nullable(),
    uncertaintyReason: z.string().min(1).nullable(),
    evidence: z.array(EvidenceSchema).min(1),
    sourceOrder: z.number().int().nonnegative()
  })
  .strict()
  .superRefine((value, context) => {
    if (value.draftCredit === null && value.uncertaintyReason === null) {
      context.addIssue({
        code: "custom",
        path: ["uncertaintyReason"],
        message: "An unscored suggestion requires an uncertainty reason."
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
  draftCredit: PrimaryCredit | null,
  mutation: ReviewDecisionMutation
): DecisionOrigin {
  if (mutation.dismissed) return "DISMISSED";
  if (draftCredit === null) return "SCORED_INDEPENDENTLY";
  return mutation.finalCredit === draftCredit ? "ACCEPTED" : "OVERRIDDEN";
}

function emptyCreditCounts(): Record<PrimaryCredit, number> {
  return { PRESENT: 0, EMERGING: 0, NOT_OBSERVED: 0, NOT_APPLICABLE: 0 };
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
    DISMISSED: 0
  };
  const credits = emptyCreditCounts();
  const domainCounts = new Map<string, Record<PrimaryCredit, number>>();
  const included: ReviewSummary["included"][number][] = [];
  const dismissed: ReviewSummary["dismissed"][number][] = [];

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
    const currentDomainCounts = domainCounts.get(suggestion.domain) ?? emptyCreditCounts();
    currentDomainCounts[decision.finalCredit] += 1;
    domainCounts.set(suggestion.domain, currentDomainCounts);
    included.push({ suggestion, decision });
  }

  const actioned = decisions.length;
  const total = suggestions.length;
  return {
    progress: {
      total,
      actioned,
      remaining: total - actioned,
      percent: total === 0 ? 0 : Math.round((actioned / total) * 100)
    },
    origins,
    credits,
    domains: [...domainCounts.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([domain, domainCredits]) => ({ domain, credits: domainCredits })),
    included,
    dismissed
  };
}
