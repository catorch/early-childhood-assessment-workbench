import { describe, expect, it } from "vitest";

import { SkillSuggestionSchema } from "./domain";
import { SanitizedScoringResultSchema, createFakeScoringResult } from "./fake-scoring";

describe("sanitized scoring adapter", () => {
  it("returns a deterministic mix of drafted and uncertain valid suggestions", () => {
    const suggestions = createFakeScoringResult("run-test");

    expect(suggestions.every((suggestion) => SkillSuggestionSchema.safeParse(suggestion).success)).toBe(true);
    expect(suggestions.some((suggestion) => suggestion.draftCredit === null)).toBe(true);
    expect(new Set(suggestions.map((suggestion) => suggestion.sourceSkillId)).size).toBe(suggestions.length);
  });

  it("rejects unknown result fields and duplicate suggestions", () => {
    const suggestions = createFakeScoringResult("run-contract");
    expect(SanitizedScoringResultSchema.safeParse({
      contractVersion: "sandbox-v1",
      runId: "run-contract",
      suggestions,
      hiddenFlags: ["ATYPICAL"]
    }).success).toBe(false);

    expect(SanitizedScoringResultSchema.safeParse({
      contractVersion: "sandbox-v1",
      runId: "run-contract",
      suggestions: [suggestions[0], suggestions[0]]
    }).success).toBe(false);
  });
});
