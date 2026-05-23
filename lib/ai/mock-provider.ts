import { getCurrentPrompt, getDetectionsForVideo, getSkillById } from "@/lib/data";
import { AiAssessmentOutputSchema } from "@/lib/validators/schemas";

export async function runMockAssessment(videoId: string, promptVersionId = getCurrentPrompt().id) {
  const detections = getDetectionsForVideo(videoId).map((detection) => {
    const skill = getSkillById(detection.skillId);

    return {
      skillCode: skill?.skillCode ?? detection.skillCode,
      credit: detection.credit,
      confidence: detection.confidence,
      evidenceSummary: detection.evidenceSummary,
      timestamp: detection.timestamp,
      rationale: detection.rationale,
      reviewFlags: detection.reviewFlags,
      evidenceSegments: detection.evidenceSegments
    };
  });

  const output = {
    videoId,
    promptVersionId,
    detections,
    dalSummary: {
      totalSkills: 6,
      fullCredit: detections.filter((detection) => detection.credit === "CREDIT").length,
      partialCredit: detections.filter((detection) => detection.credit === "PARTIAL_CREDIT").length,
      noCredit: detections.filter((detection) => detection.credit === "NO_CREDIT").length,
      notObserved: Math.max(
        6 -
          detections.filter((detection) =>
            ["CREDIT", "PARTIAL_CREDIT", "NO_CREDIT"].includes(detection.credit)
          ).length,
        0
      ),
      score: 0.67
    }
  };

  return AiAssessmentOutputSchema.parse(output);
}
