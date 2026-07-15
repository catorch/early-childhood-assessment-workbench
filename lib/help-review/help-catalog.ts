import type { ScoringCandidate, SupportContext } from "./scoring-contract";

/**
 * Sanitized HELP 2 working catalogue. It is deliberately limited to the pilot
 * fixtures until the content owner supplies and approves the canonical source.
 */
export const SANITIZED_HELP_CANDIDATES: readonly ScoringCandidate[] = [
  { sourceSkillId: "help-1.52", skillCode: "1.52", skillName: "Looks for object that has fallen out of sight", domain: "Cognitive", strand: "Object permanence", minimumAgeMonths: 6, maximumAgeMonths: 18, sourceOrder: 0 },
  { sourceSkillId: "help-1.58", skillCode: "1.58", skillName: "Stacks rings on post in any order", domain: "Cognitive", strand: "Means-end", minimumAgeMonths: 9, maximumAgeMonths: 24, sourceOrder: 1 },
  { sourceSkillId: "help-2.18", skillCode: "2.18", skillName: "Responds to own name", domain: "Language Receptive", strand: "Auditory attention", minimumAgeMonths: 4, maximumAgeMonths: 15, sourceOrder: 2 },
  { sourceSkillId: "help-2.41", skillCode: "2.41", skillName: "Follows simple one-step directions", domain: "Language Receptive", strand: "Comprehension", minimumAgeMonths: 12, maximumAgeMonths: 30, sourceOrder: 3 },
  { sourceSkillId: "help-3.62", skillCode: "3.62", skillName: "Walks independently across room", domain: "Gross Motor", strand: "Locomotion", minimumAgeMonths: 9, maximumAgeMonths: 24, sourceOrder: 4 },
  { sourceSkillId: "help-4.68", skillCode: "4.68", skillName: "Builds tower using two cubes", domain: "Fine Motor", strand: "Block construction", minimumAgeMonths: 12, maximumAgeMonths: 30, sourceOrder: 5 },
  { sourceSkillId: "help-5.41", skillCode: "5.41", skillName: "Shares object spontaneously", domain: "Social-Emotional", strand: "Social interactions", minimumAgeMonths: 12, maximumAgeMonths: 36, sourceOrder: 6 },
  { sourceSkillId: "help-6.22", skillCode: "6.22", skillName: "Drinks from open cup with assistance", domain: "Self-Help", strand: "Feeding", minimumAgeMonths: 9, maximumAgeMonths: 30, sourceOrder: 7 }
];

/** Age-first selection with bounded downward expansion in the same ordered catalogue. */
export function selectScoringCandidates(
  ageMonths: number,
  supportContext: SupportContext,
  candidates: readonly ScoringCandidate[] = SANITIZED_HELP_CANDIDATES
): readonly ScoringCandidate[] {
  const ageAppropriate = candidates.filter(
    (candidate) => ageMonths >= candidate.minimumAgeMonths && ageMonths <= candidate.maximumAgeMonths
  );
  const downwardWindow = supportContext === "NONE_REPORTED" ? 6 : 12;
  const downward = candidates.filter(
    (candidate) =>
      candidate.maximumAgeMonths < ageMonths &&
      candidate.maximumAgeMonths >= Math.max(0, ageMonths - downwardWindow)
  );
  const closestLower = candidates
    .filter((candidate) => candidate.maximumAgeMonths < ageMonths)
    .sort((left, right) => right.maximumAgeMonths - left.maximumAgeMonths)
    .slice(0, 8);
  const selected = ageAppropriate.length > 0
    ? [...ageAppropriate, ...downward]
    : downward.length > 0
      ? downward
      : closestLower.length > 0
        ? closestLower
        : candidates;
  return [...new Map(selected.map((candidate) => [candidate.sourceSkillId, candidate])).values()]
    .sort((left, right) => left.sourceOrder - right.sourceOrder);
}
