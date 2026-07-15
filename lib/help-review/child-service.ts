import type { NextRequest } from "next/server";

import { deriveReviewSummary } from "./domain";
import { assessmentActionLabel, assessmentDestination } from "./presentation";
import { clientVideo } from "./public-projections";
import { AccessError, activeUserFromState, hasActiveAssignment, requireChildAssignment } from "./server-auth";
import { readPilotState } from "./server-store";

export interface ChildServiceDependencies {
  readonly readState: typeof readPilotState;
}

const defaultDependencies: ChildServiceDependencies = {
  readState: readPilotState
};

function assessmentListItem(assessment: Awaited<ReturnType<typeof readPilotState>>["assessments"][number]) {
  return {
    id: assessment.id,
    observationDate: assessment.observationDate,
    status: assessment.status,
    updatedAt: assessment.updatedAt,
    progress: assessment.suggestions.length > 0
      ? deriveReviewSummary(assessment.suggestions, assessment.decisions).progress
      : null,
    actionHref: assessmentDestination(assessment),
    actionLabel: assessmentActionLabel(assessment)
  };
}

export function createChildService(dependencies: ChildServiceDependencies = defaultDependencies) {
  return {
    async listAssigned(request: NextRequest) {
      const state = await dependencies.readState();
      const actor = activeUserFromState(request, state);
      if (actor.role !== "EDUCATOR") throw new AccessError("The requested resource is unavailable.");
      const children = state.children
        .filter((child) => child.isActive && hasActiveAssignment(state, actor.id, child.id))
        .map((child) => ({
          ...child,
          assessments: state.assessments
            .filter((assessment) => assessment.childId === child.id && assessment.educatorId === actor.id)
            .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
            .map(assessmentListItem)
        }));
      return { children };
    },

    async detail(request: NextRequest, childId: string) {
      const state = await dependencies.readState();
      const actor = activeUserFromState(request, state);
      if (actor.role !== "EDUCATOR") throw new AccessError("The requested resource is unavailable.");
      requireChildAssignment(state, actor.id, childId);
      const child = state.children.find((candidate) => candidate.id === childId && candidate.isActive);
      if (!child) throw new AccessError("The requested resource is unavailable.");
      const assessments = state.assessments
        .filter((assessment) => assessment.childId === child.id && assessment.educatorId === actor.id)
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
        .map((assessment) => ({
          id: assessment.id,
          childId: assessment.childId,
          observationDate: assessment.observationDate,
          status: assessment.status,
          updatedAt: assessment.updatedAt,
          actionHref: assessmentDestination(assessment),
          actionLabel: assessmentActionLabel(assessment),
          video: clientVideo(assessment.video)
        }));
      return { child, assessments };
    }
  };
}

export const childService = createChildService();
