/** Deterministic scientist-service adapter for sanitized local development. */

import { z } from "zod";

import { SkillSuggestionSchema, type SkillSuggestion } from "./domain";

export const SanitizedScoringResultSchema = z.object({
  contractVersion: z.literal("sandbox-v1"),
  runId: z.string().min(1),
  suggestions: z.array(SkillSuggestionSchema).min(1).max(500)
}).strict().superRefine((value, context) => {
  const ids = new Set<string>();
  const sourceSkillIds = new Set<string>();
  const sourceOrders = new Set<number>();
  for (const suggestion of value.suggestions) {
    if (ids.has(suggestion.id) || sourceSkillIds.has(suggestion.sourceSkillId) || sourceOrders.has(suggestion.sourceOrder)) {
      context.addIssue({
        code: "custom",
        path: ["suggestions"],
        message: "Suggestion identifiers and source order must be unique within a result."
      });
      return;
    }
    ids.add(suggestion.id);
    sourceSkillIds.add(suggestion.sourceSkillId);
    sourceOrders.add(suggestion.sourceOrder);
  }
});

export function createFakeScoringResult(runId: string): readonly SkillSuggestion[] {
  const result = SanitizedScoringResultSchema.parse({
    contractVersion: "sandbox-v1",
    runId,
    suggestions: [
      {
        id: `${runId}-suggestion-1`,
        sourceSkillId: "help-4.68",
        skillCode: "4.68",
        skillName: "Builds tower using two cubes",
        domain: "Fine Motor",
        strand: "Block construction",
        draftCredit: null,
        confidence: null,
        uncertaintyReason: "The action is visible, but the completion boundary is unclear.",
        evidence: [{ timestampSeconds: 18, explanation: "The child aligns two cubes and releases the upper cube." }],
        sourceOrder: 0
      },
      {
        id: `${runId}-suggestion-2`,
        sourceSkillId: "help-2.41",
        skillCode: "2.41",
        skillName: "Follows simple one-step directions",
        domain: "Language Receptive",
        strand: "Comprehension",
        draftCredit: null,
        confidence: null,
        uncertaintyReason: "The verbal prompt is partially obscured by background sound.",
        evidence: [{ timestampSeconds: 48, explanation: "The educator gives a direction and the child responds with the requested object." }],
        sourceOrder: 1
      },
      {
        id: `${runId}-suggestion-3`,
        sourceSkillId: "help-1.52",
        skillCode: "1.52",
        skillName: "Looks for object that has fallen out of sight",
        domain: "Cognitive",
        strand: "Object permanence",
        draftCredit: "PRESENT",
        confidence: 0.94,
        uncertaintyReason: null,
        evidence: [{ timestampSeconds: 22, explanation: "The child immediately searches behind the container after the object drops." }],
        sourceOrder: 2
      },
      {
        id: `${runId}-suggestion-4`,
        sourceSkillId: "help-1.58",
        skillCode: "1.58",
        skillName: "Stacks rings on post in any order",
        domain: "Cognitive",
        strand: "Means-end",
        draftCredit: "PRESENT",
        confidence: 0.88,
        uncertaintyReason: null,
        evidence: [{ timestampSeconds: 67, explanation: "The child places three rings on the post without assistance." }],
        sourceOrder: 3
      },
      {
        id: `${runId}-suggestion-5`,
        sourceSkillId: "help-3.62",
        skillCode: "3.62",
        skillName: "Walks independently across room",
        domain: "Gross Motor",
        strand: "Locomotion",
        draftCredit: "PRESENT",
        confidence: 0.97,
        uncertaintyReason: null,
        evidence: [{ timestampSeconds: 38, endTimestampSeconds: 44, explanation: "The child crosses the play area without support." }],
        sourceOrder: 4
      },
      {
        id: `${runId}-suggestion-6`,
        sourceSkillId: "help-5.41",
        skillCode: "5.41",
        skillName: "Shares object spontaneously",
        domain: "Social-Emotional",
        strand: "Social interactions",
        draftCredit: "EMERGING",
        confidence: 0.72,
        uncertaintyReason: null,
        evidence: [
          { timestampSeconds: 91, explanation: "The child offers a toy, then pulls it back before the peer takes it." },
          { timestampSeconds: 96, explanation: "After a prompt, the child offers the toy again but continues holding it." }
        ],
        sourceOrder: 5
      },
      {
        id: `${runId}-suggestion-7`,
        sourceSkillId: "help-2.18",
        skillCode: "2.18",
        skillName: "Responds to own name",
        domain: "Language Receptive",
        strand: "Auditory attention",
        draftCredit: "NOT_OBSERVED",
        confidence: 0.84,
        uncertaintyReason: null,
        evidence: [{ timestampSeconds: 75, explanation: "Two clear name calls occur without an observable orientation response." }],
        sourceOrder: 6
      },
      {
        id: `${runId}-suggestion-8`,
        sourceSkillId: "help-6.22",
        skillCode: "6.22",
        skillName: "Drinks from open cup with assistance",
        domain: "Self-Help",
        strand: "Feeding",
        draftCredit: null,
        confidence: null,
        uncertaintyReason: "No open-cup opportunity occurs in this observation.",
        evidence: [{ timestampSeconds: 106, explanation: "No open-cup opportunity occurs in the observation." }],
        sourceOrder: 7
      }
    ]
  });
  return result.suggestions;
}
