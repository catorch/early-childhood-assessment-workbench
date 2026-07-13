import { NextRequest, NextResponse } from "next/server";

import { activeUserFromState } from "@/lib/help-review/server-auth";
import { routeError } from "@/lib/help-review/server-http";
import { readPilotState } from "@/lib/help-review/server-store";
import { safeProcessingError } from "@/lib/help-review/server-workflow";

export async function GET(request: NextRequest) {
  try {
    const state = await readPilotState();
    const actor = activeUserFromState(request, state);
    if (actor.role !== "ADMIN") return NextResponse.json({ error: "Resource unavailable." }, { status: 404 });
    const stuckBefore = Date.now() - 15 * 60 * 1_000;
    const jobs = state.assessments.flatMap((assessment) => {
      const current = assessment.runs.at(-1);
      if (!current) return [];
      const stuck = (current.status === "QUEUED" || current.status === "RUNNING") && new Date(current.requestedAt).getTime() <= stuckBefore;
      if (current.status !== "FAILED" && !stuck) return [];
      const child = state.children.find((candidate) => candidate.id === assessment.childId);
      const safeErrorCode = stuck ? "PROCESSING_STUCK" : current.safeErrorCode;
      return [{
        assessmentId: assessment.id,
        observationDate: assessment.observationDate,
        childId: assessment.childId,
        childExternalId: child?.externalChildId ?? "Unavailable child",
        videoAvailable: assessment.video !== null,
        videoFilename: assessment.video?.originalFilename ?? null,
        retryEligible: assessment.video !== null && child?.processingAllowed === true,
        error: safeProcessingError(safeErrorCode),
        run: { ...current, safeErrorCode },
        attempts: assessment.runs.map((attempt) => ({
          id: attempt.id,
          attempt: attempt.attempt,
          status: attempt.status,
          requestedAt: attempt.requestedAt,
          completedAt: attempt.completedAt,
          safeErrorCode: attempt.safeErrorCode
        }))
      }];
    }).sort((left, right) => right.run.requestedAt.localeCompare(left.run.requestedAt));
    return NextResponse.json({ jobs });
  } catch (error) {
    return routeError(error);
  }
}
