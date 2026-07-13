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
  readonly storageKey: string;
  readonly originalFilename: string;
  readonly contentType: string;
  readonly byteSize: number;
  readonly durationSeconds?: number | null;
  readonly uploadedAt: string;
  readonly uploadedById: string;
}

export interface ProcessingRun {
  readonly id: string;
  readonly attempt: number;
  status: "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED";
  readonly externalJobId: string;
  readonly requestedAt: string;
  readonly requestedById: string;
  readyAt: string | null;
  completedAt: string | null;
  safeErrorCode: string | null;
}

export interface PilotAssessment {
  readonly id: string;
  readonly childId: string;
  readonly educatorId: string;
  readonly observationDate: string;
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
