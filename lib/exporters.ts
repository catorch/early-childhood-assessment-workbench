import { detections, humanRatings, promptVersions, reliabilityReport, videos } from "@/lib/data";

export type ExportType = "ai-outputs" | "human-ratings" | "review-overrides" | "reliability" | "prompt-log";

export function exportJson(type: ExportType) {
  return JSON.stringify(getExportRows(type), null, 2);
}

export function exportCsv(type: ExportType) {
  const rows = getExportRows(type);
  if (rows.length === 0) return "";

  const headers = Object.keys(rows[0]);
  const csvRows = [
    headers.join(","),
    ...rows.map((row) =>
      headers
        .map((header) => {
          const value = row[header];
          const normalized = typeof value === "object" ? JSON.stringify(value) : String(value ?? "");
          return `"${normalized.replaceAll('"', '""')}"`;
        })
        .join(",")
    )
  ];

  return csvRows.join("\n");
}

function getExportRows(type: ExportType): Array<Record<string, unknown>> {
  if (type === "ai-outputs") {
    return detections.map((detection) => ({
      ai_detection_id: detection.id,
      video_id: detection.videoId,
      ai_run_id: detection.aiRunId,
      skill_id: detection.skillId,
      skill_code: detection.skillCode,
      domain: detection.domain,
      strand: detection.strand,
      credit: detection.credit,
      confidence: detection.confidence,
      evidence_summary: detection.evidenceSummary,
      evidence_segments: detection.evidenceSegments,
      review_flags: detection.reviewFlags
    }));
  }

  if (type === "human-ratings") {
    return humanRatings.map((rating) => ({
      human_rating_id: rating.id,
      video_id: rating.videoId,
      skill_id: rating.skillId,
      rater_id: rating.raterId,
      credit: rating.credit,
      notes: rating.notes
    }));
  }

  if (type === "review-overrides") {
    return detections
      .filter((detection) => detection.needsReview)
      .map((detection) => ({
        ai_detection_id: detection.id,
        video_id: detection.videoId,
        original_credit: detection.credit,
        corrected_credit: detection.humanCredit ?? "UNCERTAIN",
        reviewer_id: "user_sarah_chen",
        reviewer_note: "Seeded disagreement requiring reviewer decision."
      }));
  }

  if (type === "reliability") {
    return [
      {
        report_id: reliabilityReport.id,
        prompt_version_id: reliabilityReport.promptVersionId,
        dataset_split: reliabilityReport.datasetSplit,
        exact_agreement: reliabilityReport.exactAgreement,
        cohen_kappa: reliabilityReport.cohenKappa,
        total_comparisons: reliabilityReport.totalComparisons,
        agreed: reliabilityReport.agreed,
        disagreements: reliabilityReport.disagreements,
        target_met: reliabilityReport.targetMet,
        confusion_matrix: reliabilityReport.confusionMatrix,
        error_patterns: reliabilityReport.topDisagreementPatterns
      }
    ];
  }

  if (type === "prompt-log") {
    return promptVersions.map((prompt) => ({
      prompt_version_id: prompt.id,
      name: prompt.name,
      version: prompt.version,
      model_name: prompt.modelName,
      model_config: prompt.modelConfig,
      status: prompt.status,
      exact_agreement: prompt.exactAgreement,
      cohen_kappa: prompt.cohenKappa,
      change_notes: prompt.changeNotes
    }));
  }

  return videos.map((video) => ({ video_id: video.id, filename: video.filename }));
}
