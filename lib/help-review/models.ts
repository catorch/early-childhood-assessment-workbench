/** Shared application projections for the sanitized pilot adapters and UI. */

import type {
  AssessmentStatus,
  SavedReviewDecision,
  SkillSuggestion
} from "./domain";

export type Role = "EDUCATOR" | "ADMIN";

export interface PilotUser {
  readonly id: string;
  readonly externalSubject: string;
  readonly email: string;
  readonly displayName: string;
  readonly role: Role;
  readonly isActive: boolean;
}

export interface PilotChild {
  readonly id: string;
  readonly externalChildId: string;
  readonly ageMonths: number;
  readonly contextLabel: string | null;
  readonly processingAllowed: boolean;
  readonly isActive: boolean;
}

export interface ChildAssignment {
  readonly id: string;
  readonly educatorId: string;
  readonly childId: string;
  active: boolean;
  updatedAt: string;
  updatedById: string;
}

export interface StoredVideo {
  readonly id: string;
  readonly storageProvider?: "local" | "vercel-blob" | "gcs";
  readonly storageKey: string;
  readonly storageBucket?: string | null;
  readonly storageGeneration?: string | null;
  readonly originalFilename: string;
  readonly contentType: string;
  readonly byteSize: number;
  readonly durationSeconds?: number | null;
  readonly checksumSha256?: string | null;
  readonly checksumCrc32c?: string | null;
  readonly uploadedAt: string;
  readonly uploadedById: string;
}

/** Browser-safe video metadata. Storage paths, checksums, and uploader identifiers stay server-side. */
export interface ClientVideo {
  readonly id: string;
  readonly originalFilename: string;
  readonly contentType: string;
  readonly byteSize: number;
  readonly durationSeconds: number | null;
  readonly uploadedAt: string;
}

export interface SessionUser {
  readonly id: string;
  readonly displayName: string;
  readonly role: Role;
}

export interface AssessmentHistoryItem {
  readonly id: string;
  readonly childId: string;
  readonly observationDate: string;
  readonly status: AssessmentStatus;
  readonly updatedAt: string;
  readonly actionHref: string;
  readonly actionLabel: string;
  readonly video: ClientVideo | null;
}

export interface ProcessingRun {
  readonly id: string;
  readonly attempt: number;
  status: "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED";
  readonly externalJobId: string;
  readonly requestedAt: string;
  readonly requestedById: string;
  startedAt?: string | null;
  readyAt: string | null;
  completedAt: string | null;
  safeErrorCode: string | null;
  scoringConfigurationReference?: string | null;
  retryOfRunId?: string | null;
  triggerEventId?: string | null;
  triggerObjectGeneration?: string | null;
  deliveryCount?: number;
  lastDispatchedAt?: string | null;
}

export interface ClientProcessingRun {
  readonly id: string;
  readonly attempt: number;
  readonly status: ProcessingRun["status"];
  readonly requestedAt: string;
  readonly startedAt: string | null;
  readonly completedAt: string | null;
  readonly safeErrorCode: string | null;
  readonly retryOfRunId: string | null;
}

export interface AssessmentContextSnapshot {
  readonly ageMonthsAtObservation: number;
  readonly supportContext: "NONE_REPORTED" | "IFSP" | "DISABILITY" | "IFSP_AND_DISABILITY" | "UNKNOWN";
  readonly contextLabel: string | null;
  readonly processingAllowedAtCreation: boolean;
  readonly capturedAt: string;
  readonly source: "SANITIZED_ADMIN" | "ROSTER_ADAPTER";
}

export interface PilotAssessment {
  readonly id: string;
  readonly childId: string;
  readonly educatorId: string;
  readonly observationDate: string;
  readonly contextSnapshot?: AssessmentContextSnapshot;
  readonly contentCatalogVersion?: string;
  readonly scoringContractVersion?: string;
  status: AssessmentStatus;
  video: StoredVideo | null;
  runs: ProcessingRun[];
  suggestions: SkillSuggestion[];
  decisions: SavedReviewDecision[];
  finalizedAt: string | null;
  finalizedById: string | null;
  readonly createdAt: string;
  updatedAt: string;
  revision?: number;
  readonly clientRequestId?: string;
  finalizationKey?: string | null;
}

export interface AccessProvision {
  readonly id: string;
  readonly exactEmail: string;
  readonly userId: string;
  readonly role: Role;
  active: boolean;
  updatedAt: string;
  updatedById: string;
}

export interface PilotState {
  readonly fixtureVersion: 1;
  users: PilotUser[];
  children: PilotChild[];
  assignments: ChildAssignment[];
  assessments: PilotAssessment[];
  access: AccessProvision[];
  supportEvents?: SupportEvent[];
  videoAccessGrants?: VideoAccessGrantRecord[];
}

export interface VideoAccessGrantRecord {
  readonly id: string;
  readonly assessmentId: string;
  readonly videoAssetId: string;
  readonly viewerId: string;
  readonly purpose: "EDUCATOR_REVIEW";
  readonly issuedAt: string;
  readonly expiresAt: string;
}

export interface SupportEvent {
  readonly id: string;
  readonly type:
    | "VIDEO_ACCESSED"
    | "DECISION_SAVED"
    | "PROCESSING_RETRIED"
    | "ACCESS_CHANGED"
    | "ASSIGNMENT_CHANGED"
    | "ASSESSMENT_FINALIZED";
  readonly actorId: string;
  readonly occurredAt: string;
  readonly assessmentId?: string;
  readonly subjectId?: string;
  readonly referenceId?: string;
}

export interface AssessmentListItem {
  readonly id: string;
  readonly observationDate: string;
  readonly status: AssessmentStatus;
  readonly updatedAt: string;
  readonly progress: { readonly actioned: number; readonly total: number } | null;
  readonly actionHref: string;
  readonly actionLabel: string;
}

export interface EducatorAssessmentProjection extends AssessmentListItem {
  readonly childId: string;
  readonly childExternalId: string;
  readonly childAgeMonths: number;
  readonly actionHref: string;
  readonly actionLabel: string;
}

export interface AssignedChildProjection extends PilotChild {
  readonly assessments: readonly AssessmentListItem[];
}
