import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { deriveReviewSummary } from "@/lib/help-review/domain";
import { activeUserFromState } from "@/lib/help-review/server-auth";
import { recordSupportEvent } from "@/lib/help-review/server-events";
import { assertSameOrigin, routeError, validationError } from "@/lib/help-review/server-http";
import { requireAssessment, reviewProjection } from "@/lib/help-review/server-workflow";
import { updatePilotState } from "@/lib/help-review/server-store";

const FinalizationMutationSchema = z.object({
  expectedRevision: z.number().int().nonnegative(),
  requestId: z.uuid()
}).strict();

export async function POST(request: NextRequest, context: { params: Promise<{ assessmentId: string }> }) {
  try {
    assertSameOrigin(request);
    const { assessmentId } = await context.params;
    const parsed = FinalizationMutationSchema.safeParse(await request.json());
    if (!parsed.success) return validationError("The final confirmation is invalid. Refresh the summary and try again.");
    const result = await updatePilotState((state) => {
      const actor = activeUserFromState(request, state);
      const assessment = requireAssessment(state, actor, assessmentId);
      if (assessment.status === "FINALIZED") return { finalized: true as const, projection: reviewProjection(state, assessment) };
      if ((assessment.revision ?? 0) !== parsed.data.expectedRevision) {
        return { finalized: false as const, remaining: 0, stale: true as const };
      }
      const summary = deriveReviewSummary(assessment.suggestions, assessment.decisions);
      if (summary.progress.total === 0) return { finalized: false as const, remaining: 0, invalid: true as const };
      if (summary.progress.remaining > 0) return { finalized: false as const, remaining: summary.progress.remaining };
      const finalizedAt = new Date().toISOString();
      assessment.status = "FINALIZED";
      assessment.finalizedAt = finalizedAt;
      assessment.finalizedById = actor.id;
      assessment.finalizationKey = parsed.data.requestId;
      assessment.updatedAt = finalizedAt;
      assessment.revision = (assessment.revision ?? 0) + 1;
      recordSupportEvent(state, {
        type: "ASSESSMENT_FINALIZED",
        actorId: actor.id,
        assessmentId: assessment.id,
        occurredAt: finalizedAt
      });
      return { finalized: true as const, projection: reviewProjection(state, assessment) };
    });
    if (!result.finalized) {
      return NextResponse.json(
        {
          error: "invalid" in result
            ? "A validated suggestion set is required before finalization."
            : "stale" in result
              ? "This assessment changed after the summary loaded. Refresh before confirming."
            : `${result.remaining} review item(s) still need an action.`
        },
        { status: 409 }
      );
    }
    return NextResponse.json(result.projection);
  } catch (error) {
    return routeError(error);
  }
}
