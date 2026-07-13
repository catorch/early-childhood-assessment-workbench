import { describe, expect, it } from "vitest";

import {
  ASSESSMENT_STATUSES,
  DECISION_ORIGINS,
  DecisionOriginSchema,
  PRIMARY_CREDITS,
  ReviewDecisionMutationSchema,
  deriveDecisionOrigin,
  deriveReviewSummary,
  type SavedReviewDecision,
  type SkillSuggestion
} from "./domain";

describe("HELP Review domain", () => {
  it("keeps only the four provisional primary credits", () => {
    expect(PRIMARY_CREDITS).toEqual(["PRESENT", "EMERGING", "NOT_OBSERVED", "NOT_APPLICABLE"]);
  });

  it("keeps only decision origins confirmed by the workflow", () => {
    expect(DECISION_ORIGINS).toEqual(["ACCEPTED", "OVERRIDDEN", "SCORED_INDEPENDENTLY", "DISMISSED"]);
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

    expect(deriveDecisionOrigin("PRESENT", accepted)).toBe("ACCEPTED");
    expect(deriveDecisionOrigin("PRESENT", overridden)).toBe("OVERRIDDEN");
    expect(deriveDecisionOrigin(null, accepted)).toBe("SCORED_INDEPENDENTLY");
    expect(deriveDecisionOrigin("PRESENT", dismissed)).toBe("DISMISSED");
  });

  it("rejects unsupported legacy decision origins", () => {
    expect(DecisionOriginSchema.safeParse("MANUALLY_ADDED").success).toBe(false);
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
  });

  it("rejects decisions that reference a suggestion outside the assessment", () => {
    expect(() => deriveReviewSummary([], [{ suggestionId: "foreign", educatorId: "educator-1", origin: "DISMISSED", finalCredit: null, dismissed: true, note: null, revision: 1, decidedAt: "2026-07-13T00:00:00.000Z" }])).toThrow("unknown suggestion");
  });
});
