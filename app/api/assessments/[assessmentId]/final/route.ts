import { NextRequest, NextResponse } from "next/server";

import { activeUserFromState } from "@/lib/help-review/server-auth";
import { routeError } from "@/lib/help-review/server-http";
import { readPilotState } from "@/lib/help-review/server-store";
import { requireAssessment, reviewProjection } from "@/lib/help-review/server-workflow";

export async function GET(request: NextRequest, context: { params: Promise<{ assessmentId: string }> }) {
  try {
    const { assessmentId } = await context.params;
    const state = await readPilotState();
    const actor = activeUserFromState(request, state);
    const assessment = requireAssessment(state, actor, assessmentId);
    if (assessment.status !== "FINALIZED") {
      return NextResponse.json({ error: "The final assessment is not available." }, { status: 409 });
    }
    return NextResponse.json(reviewProjection(state, assessment));
  } catch (error) {
    return routeError(error);
  }
}
