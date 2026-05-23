import { NextRequest, NextResponse } from "next/server";

import { detections, humanRatings, reliabilityReport } from "@/lib/data";
import { calculateReliabilityMetrics, groupComparisons, type ReliabilityComparison } from "@/lib/reliability/metrics";

export async function GET(request: NextRequest) {
  const groupBy = request.nextUrl.searchParams.get("groupBy") as "domain" | "strand" | "skillId" | null;
  const comparisons = buildComparisons();

  if (groupBy) {
    const groups = groupComparisons(comparisons, groupBy);
    return NextResponse.json({
      data: Object.entries(groups).map(([key, rows]) => ({
        key,
        metrics: calculateReliabilityMetrics(rows)
      }))
    });
  }

  return NextResponse.json({
    data: reliabilityReport,
    calculated: calculateReliabilityMetrics(comparisons)
  });
}

export async function POST() {
  const comparisons = buildComparisons();
  const metrics = calculateReliabilityMetrics(comparisons);

  return NextResponse.json({
    reportId: `report_${Date.now()}`,
    datasetSplit: "validation",
    metrics,
    targetMet: metrics.exactAgreement >= 0.9
  });
}

function buildComparisons(): ReliabilityComparison[] {
  return detections.flatMap((detection) => {
    const humanRating = humanRatings.find(
      (rating) => rating.videoId === detection.videoId && rating.skillId === detection.skillId
    );

    if (!humanRating) return [];

    return {
      videoId: detection.videoId,
      skillId: detection.skillId,
      domain: detection.domain,
      strand: detection.strand,
      aiCredit: detection.credit,
      humanCredit: humanRating.credit
    };
  });
}
