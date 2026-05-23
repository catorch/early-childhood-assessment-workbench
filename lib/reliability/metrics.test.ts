import { describe, expect, it } from "vitest";

import { calculateReliabilityMetrics } from "@/lib/reliability/metrics";

describe("calculateReliabilityMetrics", () => {
  it("returns zeros for empty comparison sets", () => {
    const metrics = calculateReliabilityMetrics([]);

    expect(metrics.exactAgreement).toBe(0);
    expect(metrics.totalComparisons).toBe(0);
    expect(metrics.cohenKappa).toBeUndefined();
  });

  it("calculates exact agreement and confusion matrix", () => {
    const metrics = calculateReliabilityMetrics([
      {
        videoId: "v1",
        skillId: "s1",
        domain: "Social-Emotional",
        aiCredit: "CREDIT",
        humanCredit: "CREDIT"
      },
      {
        videoId: "v2",
        skillId: "s1",
        domain: "Social-Emotional",
        aiCredit: "NO_CREDIT",
        humanCredit: "CREDIT"
      },
      {
        videoId: "v3",
        skillId: "s2",
        domain: "Language",
        aiCredit: "PARTIAL_CREDIT",
        humanCredit: "PARTIAL_CREDIT"
      }
    ]);

    expect(metrics.totalComparisons).toBe(3);
    expect(metrics.agreed).toBe(2);
    expect(metrics.exactAgreement).toBeCloseTo(2 / 3);
    expect(metrics.confusionMatrix.CREDIT.NO_CREDIT).toBe(1);
  });

  it("returns perfect kappa when all assignments match in one category", () => {
    const metrics = calculateReliabilityMetrics([
      {
        videoId: "v1",
        skillId: "s1",
        domain: "Cognitive",
        aiCredit: "CREDIT",
        humanCredit: "CREDIT"
      }
    ]);

    expect(metrics.cohenKappa).toBe(1);
  });
});
