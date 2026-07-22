import { describe, expect, it } from "vitest";

import {
  ASSESSMENT_STATUSES,
  DECISION_ORIGINS,
  DecisionOriginSchema,
  PRIMARY_CREDITS,
  ReviewDecisionMutationSchema,
  SkillSuggestionSchema,
  deriveDecisionOrigin,
  deriveReviewSummary,
  findSequentialCreditConflicts,
  type SavedReviewDecision,
  type SkillSuggestion
} from "./domain";

describe("HELP Review domain", () => {
  it("keeps model and educator-only credit choices explicit", () => {
    expect(PRIMARY_CREDITS).toEqual([
      "PRESENT",
      "EMERGING",
      "NOT_OBSERVED",
      "BLANK",
      "NOT_APPLICABLE",
      "ATYPICAL",
      "ATYPICAL_PLUS",
      "ATYPICAL_MINUS",
      "ATYPICAL_EMERGING"
    ]);
  });

  it("keeps only decision origins confirmed by the workflow", () => {
    expect(DECISION_ORIGINS).toEqual(["ACCEPTED", "OVERRIDDEN", "SCORED_INDEPENDENTLY", "MANUALLY_ADDED", "DISMISSED"]);
  });

  it("accepts an included decision with a primary credit", () => {
    const result = ReviewDecisionMutationSchema.safeParse({
      expectedRevision: 0,
      finalCredit: "EMERGING",
      dismissed: false,
      note: null
    });

    expect(result.success).toBe(true);
  });

  it("rejects hidden or unsupported mutation fields", () => {
    expect(
      ReviewDecisionMutationSchema.safeParse({
        expectedRevision: 0,
        finalCredit: "PRESENT",
        dismissed: false,
        note: null,
        atypical: true
      }).success
    ).toBe(false);
  });

  it("accepts a dismissal only without a primary credit", () => {
    expect(
      ReviewDecisionMutationSchema.safeParse({
        expectedRevision: 2,
        finalCredit: null,
        dismissed: true,
        note: "Not relevant to this observation."
      }).success
    ).toBe(true);

    expect(
      ReviewDecisionMutationSchema.safeParse({
        expectedRevision: 2,
        finalCredit: "PRESENT",
        dismissed: true,
        note: null
      }).success
    ).toBe(false);
  });

  it("derives origin from the immutable draft rather than browser input", () => {
    const accepted = ReviewDecisionMutationSchema.parse({
      expectedRevision: 0,
      finalCredit: "PRESENT",
      dismissed: false,
      note: null
    });
    const overridden = { ...accepted, finalCredit: "EMERGING" as const };
    const dismissed = { ...accepted, finalCredit: null, dismissed: true };

    const modelDraft = { source: "MODEL" as const, draftCredit: "PRESENT" as const };
    const modelUncertain = { source: "MODEL" as const, draftCredit: null };
    const educatorAdded = { source: "EDUCATOR" as const, draftCredit: null };

    expect(deriveDecisionOrigin(modelDraft, accepted)).toBe("ACCEPTED");
    expect(deriveDecisionOrigin(modelDraft, overridden)).toBe("OVERRIDDEN");
    expect(deriveDecisionOrigin(modelUncertain, accepted)).toBe("SCORED_INDEPENDENTLY");
    expect(deriveDecisionOrigin(modelDraft, dismissed)).toBe("DISMISSED");
    expect(deriveDecisionOrigin(educatorAdded, accepted)).toBe("MANUALLY_ADDED");
    expect(deriveDecisionOrigin(educatorAdded, dismissed)).toBe("DISMISSED");
  });

  it("accepts the educator-added origin and still rejects unknown origins", () => {
    expect(DecisionOriginSchema.safeParse("MANUALLY_ADDED").success).toBe(true);
    expect(DecisionOriginSchema.safeParse("AMENDED").success).toBe(false);
  });

  it("requires evidence and uncertainty reasons only for model suggestions", () => {
    const educatorAdd = {
      id: "manual-1",
      sourceSkillId: "help-9",
      skillCode: "9.1",
      skillName: "Added skill",
      domain: "Cognitive",
      strand: null,
      source: "EDUCATOR",
      draftCredit: null,
      confidence: null,
      uncertaintyReason: null,
      evidence: [],
      sourceOrder: 9
    };
    expect(SkillSuggestionSchema.safeParse(educatorAdd).success).toBe(true);
    expect(SkillSuggestionSchema.safeParse({ ...educatorAdd, draftCredit: "PRESENT" }).success).toBe(false);
    expect(SkillSuggestionSchema.safeParse({ ...educatorAdd, source: "MODEL" }).success).toBe(false);
    expect(SkillSuggestionSchema.safeParse({
      ...educatorAdd,
      source: "MODEL",
      draftCredit: "NOT_APPLICABLE",
      uncertaintyReason: null,
      evidence: [{ timestampSeconds: 1, explanation: "Context only." }]
    }).success).toBe(false);
  });

  it("retains the finalized state without amendment states", () => {
    expect(ASSESSMENT_STATUSES).toContain("FINALIZED");
    expect(ASSESSMENT_STATUSES).not.toContain("AMENDED");
  });

  it("derives reconciled progress, origin, credit, and domain totals", () => {
    const suggestions: SkillSuggestion[] = [
      {
        id: "suggestion-1",
        sourceSkillId: "help-1",
        skillCode: "1.1",
        skillName: "First skill",
        domain: "Cognitive",
        strand: null,
        source: "MODEL",
        draftCredit: "PRESENT",
        confidence: 0.9,
        uncertaintyReason: null,
        evidence: [{ timestampSeconds: 3, explanation: "Observed once." }],
        sourceOrder: 0
      },
      {
        id: "suggestion-2",
        sourceSkillId: "help-2",
        skillCode: "2.1",
        skillName: "Second skill",
        domain: "Language",
        strand: null,
        source: "MODEL",
        draftCredit: null,
        confidence: null,
        uncertaintyReason: "Boundary unclear.",
        evidence: [{ timestampSeconds: 8, explanation: "Response is partially visible." }],
        sourceOrder: 1
      }
    ];
    const decisions: SavedReviewDecision[] = [
      { suggestionId: "suggestion-1", educatorId: "educator-1", origin: "ACCEPTED", finalCredit: "PRESENT", dismissed: false, note: null, revision: 1, decidedAt: "2026-07-13T00:00:00.000Z" },
      { suggestionId: "suggestion-2", educatorId: "educator-1", origin: "DISMISSED", finalCredit: null, dismissed: true, note: null, revision: 1, decidedAt: "2026-07-13T00:01:00.000Z" }
    ];

    const summary = deriveReviewSummary(suggestions, decisions);

    expect(summary.progress).toEqual({ total: 2, actioned: 2, remaining: 0, percent: 100 });
    expect(summary.credits.PRESENT).toBe(1);
    expect(summary.origins.DISMISSED).toBe(1);
    expect(summary.included).toHaveLength(1);
    expect(summary.dismissed).toHaveLength(1);
    expect(summary.domains[0]?.domain).toBe("Cognitive");
    expect(summary.coverage).toEqual({
      developmentalDomainCount: 1,
      strandCount: 0,
      skillCount: 1,
      regulatorySensorySkillCount: 0
    });
  });

  it("counts an intentional blank as actioned and distinct from no decision", () => {
    const suggestion = SkillSuggestionSchema.parse({
      id: "blank-1",
      sourceSkillId: "help-blank-1",
      skillCode: "1.1",
      skillName: "Relevant but unscored skill",
      domain: "1.0 Cognitive",
      strand: "1-1 Development",
      source: "MODEL",
      draftCredit: null,
      confidence: null,
      uncertaintyReason: "The opportunity is incomplete.",
      evidence: [{ timestampSeconds: 1, explanation: "A partial opportunity is visible." }],
      sourceOrder: 0
    });
    const summary = deriveReviewSummary([suggestion], [{
      suggestionId: suggestion.id,
      educatorId: "educator-1",
      origin: "SCORED_INDEPENDENTLY",
      finalCredit: "BLANK",
      dismissed: false,
      concernFlag: false,
      note: null,
      revision: 1,
      decidedAt: "2026-07-21T00:00:00.000Z"
    }]);
    expect(summary.progress).toMatchObject({ actioned: 1, remaining: 0 });
    expect(summary.credits.BLANK).toBe(1);
  });

  it("finds an earlier minus followed by a later plus in the same strand", () => {
    const base = {
      skillName: "Skill",
      domain: "1.0 Cognitive",
      strand: "1-1 Development",
      source: "MODEL" as const,
      confidence: 0.9,
      uncertaintyReason: null,
      evidence: [{ timestampSeconds: 1, explanation: "Observed opportunity." }]
    };
    const suggestions: SkillSuggestion[] = [
      { ...base, id: "earlier", sourceSkillId: "earlier", skillCode: "1.1", draftCredit: "NOT_OBSERVED", sourceOrder: 1 },
      { ...base, id: "later", sourceSkillId: "later", skillCode: "1.2", draftCredit: "PRESENT", sourceOrder: 2 }
    ];
    const decisions: SavedReviewDecision[] = [
      { suggestionId: "earlier", educatorId: "educator-1", origin: "ACCEPTED", finalCredit: "NOT_OBSERVED", dismissed: false, note: null, revision: 1, decidedAt: "2026-07-21T00:00:00.000Z" },
      { suggestionId: "later", educatorId: "educator-1", origin: "ACCEPTED", finalCredit: "PRESENT", dismissed: false, note: null, revision: 1, decidedAt: "2026-07-21T00:00:00.000Z" }
    ];
    expect(findSequentialCreditConflicts(suggestions, decisions)).toHaveLength(1);
    expect(findSequentialCreditConflicts(suggestions, [{ ...decisions[0]!, finalCredit: "BLANK" }, decisions[1]!])).toHaveLength(0);
  });

  it("rejects decisions that reference a suggestion outside the assessment", () => {
    expect(() => deriveReviewSummary([], [{ suggestionId: "foreign", educatorId: "educator-1", origin: "DISMISSED", finalCredit: null, dismissed: true, note: null, revision: 1, decidedAt: "2026-07-13T00:00:00.000Z" }])).toThrow("unknown suggestion");
  });
});
