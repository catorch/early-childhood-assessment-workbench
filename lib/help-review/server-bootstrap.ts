import type { ApplicationDependencies } from "./application-contracts";
import { createAdminAccessService } from "./admin-access-service";
import { createAdminJobsService } from "./admin-jobs-service";
import { createAssessmentService } from "./assessment-service";
import { createChildService } from "./child-service";
import { assertConfiguredHelpCatalog } from "./help-catalog";
import { processQueuedRuns, processRunById } from "./processing-coordinator";
import { createReviewService } from "./review-service";
import { assertRuntimeConfiguration } from "./runtime-config";
import {
  activeUserFromState,
  requireChildAssignment,
  selectedIdentityAdapter
} from "./server-auth";
import { recordSupportEvent } from "./server-events";
import { readPilotState, updatePilotState } from "./server-store";
import { requireAssessment } from "./server-workflow";
import { selectedScoringGateway } from "./scoring-gateway";
import { selectedVideoStorage } from "./video-storage";
import { createVideoAssetService } from "./video-asset-service";

/** Builds one guarded dependency graph; tests may inject each interface independently. */
export function createApplicationDependencies(
  environment: NodeJS.ProcessEnv = process.env
): ApplicationDependencies {
  assertRuntimeConfiguration(environment);
  assertConfiguredHelpCatalog(environment);
  const videoStorage = selectedVideoStorage(environment);
  const scoringGateway = selectedScoringGateway(environment);
  const identity = selectedIdentityAdapter(environment);
  const serviceRepository = { readState: readPilotState, updateState: updatePilotState };
  return {
    identity,
    authorization: {
      activeUser: (request, state) => activeUserFromState(request, state, identity),
      requireChildAssignment,
      requireAssessment
    },
    repository: {
      read: readPilotState,
      transaction: updatePilotState
    },
    videoStorage,
    scoringGateway,
    processing: {
      processQueued: (limit = 1) => processQueuedRuns(limit, {
        readState: readPilotState,
        updateState: updatePilotState,
        scoringGateway,
        videoStorage
      }),
      processRun: (runId) => processRunById(runId, {}, {
        readState: readPilotState,
        updateState: updatePilotState,
        scoringGateway,
        videoStorage
      })
    },
    support: { record: recordSupportEvent },
    assessments: createAssessmentService(serviceRepository),
    children: createChildService(serviceRepository),
    review: createReviewService(serviceRepository),
    videoAssets: createVideoAssetService(serviceRepository),
    adminAccess: createAdminAccessService(serviceRepository),
    adminJobs: createAdminJobsService(serviceRepository)
  };
}
