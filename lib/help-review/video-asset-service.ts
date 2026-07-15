import type { NextRequest } from "next/server";

import type { PilotState, PilotUser, StoredVideo } from "./models";
import { clientVideo } from "./public-projections";
import { activeUserFromState } from "./server-auth";
import { readPilotState, updatePilotState } from "./server-store";
import { requireAssessment } from "./server-workflow";

export interface VideoAssetServiceDependencies {
  readonly readState: typeof readPilotState;
  readonly updateState: typeof updatePilotState;
}

const defaultDependencies: VideoAssetServiceDependencies = {
  readState: readPilotState,
  updateState: updatePilotState
};

export function uploadEligibility(state: PilotState, actor: PilotUser, assessmentId: string): string | null {
  const assessment = requireAssessment(state, actor, assessmentId);
  const child = state.children.find((candidate) => candidate.id === assessment.childId && candidate.isActive);
  if (!child?.processingAllowed) return "Processing permission is not approved for this child.";
  if (!["DRAFT", "FAILED"].includes(assessment.status)) {
    return `A video cannot be replaced while the assessment is ${assessment.status.toLowerCase()}.`;
  }
  return null;
}

export function createVideoAssetService(dependencies: VideoAssetServiceDependencies = defaultDependencies) {
  return {
    async projection(request: NextRequest, assessmentId: string, uploadMode: "blob" | "gcs" | "server") {
      const state = await dependencies.readState();
      const actor = activeUserFromState(request, state);
      const assessment = requireAssessment(state, actor, assessmentId);
      return { video: clientVideo(assessment.video), uploadMode };
    },

    async authorizeUpload(request: NextRequest, assessmentId: string) {
      const state = await dependencies.readState();
      const actor = activeUserFromState(request, state);
      const reason = uploadEligibility(state, actor, assessmentId);
      if (reason) return { blocked: true as const, reason };
      const assessment = requireAssessment(state, actor, assessmentId);
      return {
        blocked: false as const,
        actorId: actor.id,
        expectedRevision: assessment.revision ?? 0
      };
    },

    async commitForRequest(request: NextRequest, assessmentId: string, video: StoredVideo) {
      return dependencies.updateState((state) => {
        const actor = activeUserFromState(request, state);
        const reason = uploadEligibility(state, actor, assessmentId);
        if (reason) return { blocked: true as const, reason };
        const assessment = requireAssessment(state, actor, assessmentId);
        const now = new Date().toISOString();
        const oldStorageKey = assessment.video?.storageKey ?? null;
        assessment.video = { ...video, uploadedAt: now, uploadedById: actor.id };
        assessment.status = "DRAFT";
        assessment.updatedAt = now;
        assessment.revision = (assessment.revision ?? 0) + 1;
        return { blocked: false as const, video: assessment.video, oldStorageKey };
      });
    },

    async commitCompletedUpload(command: {
      readonly assessmentId: string;
      readonly actorId: string;
      readonly expectedRevision: number;
      readonly video: StoredVideo;
    }) {
      return dependencies.updateState((state) => {
        const actor = state.users.find((candidate) => candidate.id === command.actorId && candidate.isActive);
        const activeAccess = state.access.some((provision) => provision.userId === actor?.id && provision.active);
        if (!actor || !activeAccess) {
          return { blocked: true as const, reason: "Pilot access changed before upload completion." };
        }
        const reason = uploadEligibility(state, actor, command.assessmentId);
        if (reason) return { blocked: true as const, reason };
        const assessment = requireAssessment(state, actor, command.assessmentId);
        if (
          assessment.video?.id === command.video.id &&
          assessment.video.storageKey === command.video.storageKey
        ) {
          return { blocked: false as const, oldStorageKey: null };
        }
        if ((assessment.revision ?? 0) !== command.expectedRevision) {
          return { blocked: true as const, reason: "The assessment changed before upload completion." };
        }
        const oldStorageKey = assessment.video?.storageKey ?? null;
        assessment.video = command.video;
        assessment.status = "DRAFT";
        assessment.updatedAt = command.video.uploadedAt;
        assessment.revision = (assessment.revision ?? 0) + 1;
        return { blocked: false as const, oldStorageKey };
      });
    },

    async remove(request: NextRequest, assessmentId: string) {
      return dependencies.updateState((state) => {
        const actor = activeUserFromState(request, state);
        const assessment = requireAssessment(state, actor, assessmentId);
        if (!["DRAFT", "FAILED"].includes(assessment.status)) {
          return { blocked: true as const, reason: "This video can no longer be removed." };
        }
        const storageKey = assessment.video?.storageKey ?? null;
        assessment.video = null;
        assessment.runs = [];
        assessment.suggestions = [];
        assessment.decisions = [];
        assessment.status = "DRAFT";
        assessment.updatedAt = new Date().toISOString();
        assessment.revision = (assessment.revision ?? 0) + 1;
        return { blocked: false as const, storageKey };
      });
    }
  };
}

export const videoAssetService = createVideoAssetService();
