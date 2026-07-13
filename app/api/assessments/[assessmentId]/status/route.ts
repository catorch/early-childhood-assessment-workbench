import { NextRequest, NextResponse } from "next/server";

import { activeUserFromState } from "@/lib/help-review/server-auth";
import { routeError } from "@/lib/help-review/server-http";
import { materializeCompletedRun, requireAssessment, safeProcessingError } from "@/lib/help-review/server-workflow";
import { updatePilotState } from "@/lib/help-review/server-store";

export async function GET(request: NextRequest, context: { params: Promise<{ assessmentId: string }> }) {
  try {
    const { assessmentId } = await context.params;
    const projection = await updatePilotState((state) => {
      const actor = activeUserFromState(request, state);
      const assessment = requireAssessment(state, actor, assessmentId);
      materializeCompletedRun(assessment);
      const child = state.children.find((candidate) => candidate.id === assessment.childId);
      if (!child) throw new Error("Assessment child is unavailable.");
      const run = assessment.runs.at(-1) ?? null;
      return {
        id: assessment.id,
        observationDate: assessment.observationDate,
        status: assessment.status,
        updatedAt: assessment.updatedAt,
        child: { id: child.id, externalChildId: child.externalChildId },
        video: assessment.video
          ? { originalFilename: assessment.video.originalFilename, byteSize: assessment.video.byteSize }
          : null,
        run,
        error: assessment.status === "FAILED" ? safeProcessingError(run?.safeErrorCode ?? null) : null,
        suggestionCount: assessment.suggestions.length,
        needsReviewCount: assessment.suggestions.filter((suggestion) => suggestion.draftCredit === null).length,
        ready: assessment.status === "READY_FOR_REVIEW" || assessment.status === "IN_REVIEW" || assessment.status === "FINALIZED"
      };
    });
    return NextResponse.json({ assessment: projection });
  } catch (error) {
    return routeError(error);
  }
}
