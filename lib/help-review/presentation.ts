import type { AssessmentStatus, PrimaryCredit } from "./domain";
import type { PilotAssessment } from "./models";

export const creditPresentation: Record<
  PrimaryCredit,
  { readonly symbol: string; readonly label: string; readonly shortLabel: string }
> = {
  PRESENT: { symbol: "+", label: "Present", shortLabel: "Present" },
  EMERGING: { symbol: "+/-", label: "Emerging", shortLabel: "Emerging" },
  NOT_OBSERVED: { symbol: "-", label: "Not observed", shortLabel: "Not observed" },
  NOT_APPLICABLE: { symbol: "N/A", label: "Not applicable", shortLabel: "N/A" }
};

export const assessmentStatusPresentation: Record<
  AssessmentStatus,
  { readonly label: string; readonly tone: "neutral" | "info" | "success" | "warning" | "danger" }
> = {
  DRAFT: { label: "Draft", tone: "neutral" },
  UPLOADING: { label: "Uploading", tone: "info" },
  PROCESSING: { label: "Processing", tone: "info" },
  READY_FOR_REVIEW: { label: "Ready for review", tone: "success" },
  IN_REVIEW: { label: "In review", tone: "warning" },
  FINALIZED: { label: "Finalized", tone: "success" },
  FAILED: { label: "Needs attention", tone: "danger" }
};

export function assessmentDestination(assessment: Pick<PilotAssessment, "id" | "childId" | "status" | "video" | "suggestions" | "decisions">): string {
  if (assessment.status === "DRAFT" || assessment.status === "UPLOADING") {
    return `/assessments/new?childId=${assessment.childId}&assessmentId=${assessment.id}`;
  }
  if (assessment.status === "PROCESSING" || assessment.status === "FAILED") {
    return `/assessments/${assessment.id}/processing`;
  }
  if (assessment.status === "FINALIZED") return `/assessments/${assessment.id}/final`;
  if (assessment.suggestions.length > 0 && assessment.decisions.length >= assessment.suggestions.length) {
    return `/assessments/${assessment.id}/summary`;
  }
  return `/assessments/${assessment.id}/review`;
}

export function assessmentActionLabel(assessment: Pick<PilotAssessment, "status" | "video" | "suggestions" | "decisions">): string {
  if (assessment.status === "DRAFT" || assessment.status === "UPLOADING") {
    return assessment.video ? "Start processing" : "Continue upload";
  }
  if (assessment.status === "PROCESSING") return "View status";
  if (assessment.status === "FAILED") return "Review failure";
  if (assessment.status === "READY_FOR_REVIEW") return "Start review";
  if (assessment.status === "IN_REVIEW") {
    return assessment.suggestions.length > 0 && assessment.decisions.length >= assessment.suggestions.length
      ? "Finish review"
      : "Continue review";
  }
  return "View final";
}

export function formatDate(value: string): string {
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.valueOf())
    ? value
    : new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

export function formatDateTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.valueOf())
    ? value
    : new Intl.DateTimeFormat("en", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit"
      }).format(date);
}
