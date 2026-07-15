import type { NextRequest } from "next/server";

import type { createAdminAccessService } from "./admin-access-service";
import type { createAdminJobsService } from "./admin-jobs-service";
import type { createAssessmentService } from "./assessment-service";
import type { createChildService } from "./child-service";
import type {
  AccessProvision,
  ChildAssignment,
  PilotAssessment,
  PilotChild,
  PilotState,
  PilotUser,
  SupportEvent
} from "./models";
import type { IdentityAdapter } from "./server-auth";
import type { ScoringGateway } from "./scoring-contract";
import type { createReviewService } from "./review-service";
import type { createVideoAssetService } from "./video-asset-service";
import type { VideoStorage } from "./video-storage";

/** Transactional aggregate repository used until live source-specific repositories replace it. */
export interface PilotRepository {
  read(): Promise<PilotState>;
  transaction<T>(mutation: (state: PilotState) => T | Promise<T>): Promise<T>;
}

export interface AuthorizationPolicy {
  activeUser(request: NextRequest, state: PilotState): PilotUser;
  requireChildAssignment(state: PilotState, educatorId: string, childId: string): void;
  requireAssessment(state: PilotState, actor: PilotUser, assessmentId: string): PilotAssessment;
}

export type AssessmentService = ReturnType<typeof createAssessmentService>;
export type ChildService = ReturnType<typeof createChildService>;
export type ReviewService = ReturnType<typeof createReviewService>;
export type VideoAssetService = ReturnType<typeof createVideoAssetService>;
export type AdminAccessService = ReturnType<typeof createAdminAccessService>;
export type AdminJobsService = ReturnType<typeof createAdminJobsService>;

export interface AdminService {
  accessProjection(request: NextRequest): Promise<{
    readonly users: readonly PilotUser[];
    readonly children: readonly PilotChild[];
    readonly access: readonly AccessProvision[];
    readonly assignments: readonly ChildAssignment[];
  }>;
  processingJobs(request: NextRequest, query: { readonly filter: string; readonly search: string }): Promise<unknown>;
}

export interface SupportRecorder {
  record(state: PilotState, event: Omit<SupportEvent, "id" | "occurredAt"> & { readonly occurredAt?: string }): SupportEvent;
}

export interface ProcessingCoordinator {
  processQueued(limit?: number): Promise<{ readonly processed: number }>;
  processRun(runId: string): Promise<{ readonly processed: boolean; readonly disposition: string }>;
}

export interface ApplicationDependencies {
  readonly identity: IdentityAdapter;
  readonly authorization: AuthorizationPolicy;
  readonly repository: PilotRepository;
  readonly videoStorage: VideoStorage;
  readonly scoringGateway: ScoringGateway;
  readonly processing: ProcessingCoordinator;
  readonly support: SupportRecorder;
  readonly assessments: AssessmentService;
  readonly children: ChildService;
  readonly review: ReviewService;
  readonly videoAssets: VideoAssetService;
  readonly adminAccess: AdminAccessService;
  readonly adminJobs: AdminJobsService;
}
