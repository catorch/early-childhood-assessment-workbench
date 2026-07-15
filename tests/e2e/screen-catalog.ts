export type ScreenMode =
  | "sign-in" | "auth-failure" | "session-expired" | "unavailable"
  | "children" | "children-empty" | "children-error" | "child-detail" | "assessments"
  | "upload-progress" | "upload-ready" | "upload-validation" | "upload-network" | "permission-blocked"
  | "processing" | "processing-failed" | "processing-ready"
  | "review" | "review-save-failure" | "review-video-unavailable" | "review-conflict" | "review-no-results" | "review-loading" | "review-editor"
  | "summary-complete" | "summary-incomplete" | "final"
  | "admin-access" | "admin-access-empty" | "admin-access-error" | "admin-deactivate" | "admin-unassign"
  | "admin-jobs" | "admin-jobs-empty" | "admin-jobs-error" | "admin-retry";

export interface ScreenCatalogEntry {
  readonly id: string;
  readonly name: string;
  readonly mode: ScreenMode;
  readonly viewport: { readonly width: number; readonly height: number };
}

const desktop = { width: 1280, height: 800 };
const mobile = { width: 360, height: 800 };
const tablet = { width: 768, height: 1024 };

export const screenCatalog: readonly ScreenCatalogEntry[] = [
  { id: "01", name: "sign-in", mode: "sign-in", viewport: desktop },
  { id: "02", name: "assigned-children", mode: "children", viewport: desktop },
  { id: "03", name: "upload-observation", mode: "upload-progress", viewport: desktop },
  { id: "04", name: "processing", mode: "processing", viewport: desktop },
  { id: "05", name: "review-workspace", mode: "review", viewport: desktop },
  { id: "06", name: "finish-review", mode: "summary-complete", viewport: desktop },
  { id: "07", name: "final-assessment", mode: "final", viewport: desktop },
  { id: "08", name: "admin-pilot-access", mode: "admin-access", viewport: desktop },
  { id: "09", name: "admin-processing-jobs", mode: "admin-jobs", viewport: desktop },
  { id: "10", name: "auth-access-unavailable", mode: "auth-failure", viewport: desktop },
  { id: "11", name: "session-expired", mode: "session-expired", viewport: desktop },
  { id: "12", name: "assigned-children-empty", mode: "children-empty", viewport: desktop },
  { id: "13", name: "children-load-error-v2", mode: "children-error", viewport: desktop },
  { id: "14", name: "child-detail-history-v2", mode: "child-detail", viewport: desktop },
  { id: "15", name: "resource-unavailable", mode: "unavailable", viewport: desktop },
  { id: "16", name: "assessments-list", mode: "assessments", viewport: desktop },
  { id: "17", name: "upload-ready", mode: "upload-ready", viewport: desktop },
  { id: "18", name: "upload-validation-error", mode: "upload-validation", viewport: desktop },
  { id: "19", name: "upload-network-failure", mode: "upload-network", viewport: desktop },
  { id: "20", name: "permission-blocked", mode: "permission-blocked", viewport: desktop },
  { id: "21", name: "processing-failed", mode: "processing-failed", viewport: desktop },
  { id: "22", name: "processing-ready", mode: "processing-ready", viewport: desktop },
  { id: "23", name: "review-save-failure", mode: "review-save-failure", viewport: desktop },
  { id: "24", name: "review-video-unavailable", mode: "review-video-unavailable", viewport: desktop },
  { id: "25", name: "review-conflict-v2", mode: "review-conflict", viewport: desktop },
  { id: "26", name: "review-no-valid-results", mode: "review-no-results", viewport: desktop },
  { id: "27", name: "summary-incomplete", mode: "summary-incomplete", viewport: desktop },
  { id: "28", name: "admin-access-empty", mode: "admin-access-empty", viewport: desktop },
  { id: "29", name: "admin-access-load-error", mode: "admin-access-error", viewport: desktop },
  { id: "30", name: "admin-deactivate-confirmation-v2", mode: "admin-deactivate", viewport: desktop },
  { id: "31", name: "admin-remove-assignment-v2", mode: "admin-unassign", viewport: desktop },
  { id: "32", name: "admin-jobs-empty-v2", mode: "admin-jobs-empty", viewport: desktop },
  { id: "33", name: "admin-retry-confirmation-v2", mode: "admin-retry", viewport: desktop },
  { id: "34", name: "mobile-assigned-children", mode: "children", viewport: mobile },
  { id: "35", name: "mobile-upload", mode: "upload-ready", viewport: mobile },
  { id: "36", name: "mobile-processing", mode: "processing", viewport: mobile },
  { id: "37", name: "mobile-review-list", mode: "review", viewport: mobile },
  { id: "38", name: "mobile-review-editor", mode: "review-editor", viewport: mobile },
  { id: "39", name: "mobile-summary", mode: "summary-complete", viewport: mobile },
  { id: "40", name: "mobile-sign-in", mode: "sign-in", viewport: mobile },
  { id: "41", name: "mobile-final-assessment", mode: "final", viewport: mobile },
  { id: "42", name: "tablet-review-workspace", mode: "review", viewport: tablet },
  { id: "43", name: "tablet-summary", mode: "summary-complete", viewport: tablet },
  { id: "44", name: "review-loading", mode: "review-loading", viewport: desktop },
  { id: "45", name: "admin-jobs-load-error", mode: "admin-jobs-error", viewport: desktop }
];
