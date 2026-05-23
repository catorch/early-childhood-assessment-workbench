import type { CreditAssignment } from "@/lib/types";

export type ReliabilityComparison = {
  videoId: string;
  skillId: string;
  domain: string;
  strand?: string;
  aiCredit: CreditAssignment;
  humanCredit: CreditAssignment;
};

export type ReliabilityMetrics = {
  exactAgreement: number;
  agreed: number;
  totalComparisons: number;
  cohenKappa?: number;
  confusionMatrix: Record<CreditAssignment, Record<CreditAssignment, number>>;
};

const creditValues: CreditAssignment[] = ["CREDIT", "PARTIAL_CREDIT", "NO_CREDIT", "NOT_OBSERVED", "UNCERTAIN"];

export function calculateReliabilityMetrics(comparisons: ReliabilityComparison[]): ReliabilityMetrics {
  const totalComparisons = comparisons.length;
  const agreed = comparisons.filter((comparison) => comparison.aiCredit === comparison.humanCredit).length;
  const confusionMatrix = createEmptyConfusionMatrix();

  for (const comparison of comparisons) {
    confusionMatrix[comparison.humanCredit][comparison.aiCredit] += 1;
  }

  if (totalComparisons === 0) {
    return {
      exactAgreement: 0,
      agreed: 0,
      totalComparisons,
      cohenKappa: undefined,
      confusionMatrix
    };
  }

  return {
    exactAgreement: agreed / totalComparisons,
    agreed,
    totalComparisons,
    cohenKappa: calculateCohensKappa(confusionMatrix, totalComparisons, agreed),
    confusionMatrix
  };
}

export function groupComparisons(
  comparisons: ReliabilityComparison[],
  key: "domain" | "strand" | "skillId"
) {
  return comparisons.reduce<Record<string, ReliabilityComparison[]>>((groups, comparison) => {
    const groupKey = comparison[key] || "Unspecified";
    groups[groupKey] ??= [];
    groups[groupKey].push(comparison);
    return groups;
  }, {});
}

function createEmptyConfusionMatrix() {
  return creditValues.reduce(
    (matrix, humanCredit) => {
      matrix[humanCredit] = creditValues.reduce(
        (row, aiCredit) => {
          row[aiCredit] = 0;
          return row;
        },
        {} as Record<CreditAssignment, number>
      );
      return matrix;
    },
    {} as Record<CreditAssignment, Record<CreditAssignment, number>>
  );
}

function calculateCohensKappa(
  confusionMatrix: Record<CreditAssignment, Record<CreditAssignment, number>>,
  total: number,
  agreed: number
) {
  const observedAgreement = agreed / total;

  const expectedAgreement = creditValues.reduce((sum, credit) => {
    const rowTotal = creditValues.reduce((rowSum, aiCredit) => rowSum + confusionMatrix[credit][aiCredit], 0);
    const columnTotal = creditValues.reduce(
      (columnSum, humanCredit) => columnSum + confusionMatrix[humanCredit][credit],
      0
    );
    return sum + (rowTotal / total) * (columnTotal / total);
  }, 0);

  if (expectedAgreement === 1) {
    return observedAgreement === 1 ? 1 : 0;
  }

  return (observedAgreement - expectedAgreement) / (1 - expectedAgreement);
}
