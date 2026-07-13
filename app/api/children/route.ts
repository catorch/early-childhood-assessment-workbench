import { NextRequest, NextResponse } from "next/server";

import { deriveReviewSummary } from "@/lib/help-review/domain";
import { assessmentActionLabel, assessmentDestination } from "@/lib/help-review/presentation";
import { AccessError, activeUserFromState, hasActiveAssignment } from "@/lib/help-review/server-auth";
import { routeError } from "@/lib/help-review/server-http";
import { readPilotState } from "@/lib/help-review/server-store";

export async function GET(request: NextRequest) {
  try {
    const state = await readPilotState();
    const actor = activeUserFromState(request, state);
    if (actor.role !== "EDUCATOR") throw new AccessError("The requested resource is unavailable.");
    const children = state.children
      .filter((child) => child.isActive && hasActiveAssignment(state, actor.id, child.id))
      .map((child) => ({
        ...child,
        assessments: state.assessments
          .filter((assessment) => assessment.childId === child.id && assessment.educatorId === actor.id)
          .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
          .map((assessment) => ({
            id: assessment.id,
            observationDate: assessment.observationDate,
            status: assessment.status,
            updatedAt: assessment.updatedAt,
            progress:
              assessment.suggestions.length > 0
                ? deriveReviewSummary(assessment.suggestions, assessment.decisions).progress
                : null,
            actionHref: assessmentDestination(assessment),
            actionLabel: assessmentActionLabel(assessment)
          }))
      }));
    return NextResponse.json({ children });
  } catch (error) {
    return routeError(error);
  }
}
