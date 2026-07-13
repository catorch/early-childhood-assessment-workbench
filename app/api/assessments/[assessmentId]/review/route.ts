import { NextRequest, NextResponse } from "next/server";

import { activeUserFromState } from "@/lib/help-review/server-auth";
import { routeError } from "@/lib/help-review/server-http";
import { materializeCompletedRun, requireAssessment, reviewProjection } from "@/lib/help-review/server-workflow";
import { updatePilotState } from "@/lib/help-review/server-store";

export async function GET(request: NextRequest, context: { params: Promise<{ assessmentId: string }> }) {
  try {
    const { assessmentId } = await context.params;
    const projection = await updatePilotState((state) => {
      const actor = activeUserFromState(request, state);
      const assessment = requireAssessment(state, actor, assessmentId);
      materializeCompletedRun(assessment);
      if (!["READY_FOR_REVIEW", "IN_REVIEW", "FINALIZED"].includes(assessment.status)) return null;
      return reviewProjection(state, assessment);
    });
    if (!projection) return NextResponse.json({ error: "Assessment review is not ready." }, { status: 409 });
    if (projection.suggestions.length === 0) {
      return NextResponse.json(
        { code: "NO_VALID_RESULTS", error: "No complete validated suggestion set is available." },
        { status: 422 }
      );
    }
    return NextResponse.json(projection);
  } catch (error) {
    return routeError(error);
  }
}
