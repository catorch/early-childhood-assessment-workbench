import { NextRequest, NextResponse } from "next/server";

import { ReviewDecisionMutationSchema, deriveDecisionOrigin, deriveReviewSummary } from "@/lib/help-review/domain";
import { activeUserFromState } from "@/lib/help-review/server-auth";
import { recordSupportEvent } from "@/lib/help-review/server-events";
import { assertSameOrigin, routeError, validationError } from "@/lib/help-review/server-http";
import { requireAssessment } from "@/lib/help-review/server-workflow";
import { updatePilotState } from "@/lib/help-review/server-store";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ assessmentId: string; suggestionId: string }> }
) {
  try {
    assertSameOrigin(request);
    const { assessmentId, suggestionId } = await context.params;
    const parsed = ReviewDecisionMutationSchema.safeParse(await request.json());
    if (!parsed.success) return validationError(parsed.error.issues[0]?.message ?? "The review decision is invalid.");
    const result = await updatePilotState((state) => {
      const actor = activeUserFromState(request, state);
      const assessment = requireAssessment(state, actor, assessmentId);
      if (assessment.status === "FINALIZED") return { conflict: "Final assessments are read-only." } as const;
      if (!["READY_FOR_REVIEW", "IN_REVIEW"].includes(assessment.status)) {
        return { conflict: "Assessment review is not ready." } as const;
      }
      const suggestion = assessment.suggestions.find((candidate) => candidate.id === suggestionId);
      if (!suggestion) return { conflict: "Review item is unavailable." } as const;
      const existingIndex = assessment.decisions.findIndex((decision) => decision.suggestionId === suggestionId);
      const existing = existingIndex >= 0 ? assessment.decisions[existingIndex] : null;
      const currentRevision = existing?.revision ?? 0;
      if (currentRevision !== parsed.data.expectedRevision) {
        return {
          conflict: "This item changed in another session. Choose which decision to keep.",
          currentDecision: existing,
          summary: deriveReviewSummary(assessment.suggestions, assessment.decisions)
        } as const;
      }
      const decidedAt = new Date().toISOString();
      const decision = {
        suggestionId,
        educatorId: actor.id,
        origin: deriveDecisionOrigin(suggestion.draftCredit, parsed.data),
        finalCredit: parsed.data.finalCredit,
        dismissed: parsed.data.dismissed,
        note: parsed.data.note,
        revision: currentRevision + 1,
        decidedAt
      };
      if (existingIndex >= 0) assessment.decisions[existingIndex] = decision;
      else assessment.decisions.push(decision);
      assessment.status = "IN_REVIEW";
      assessment.updatedAt = decidedAt;
      assessment.revision = (assessment.revision ?? 0) + 1;
      recordSupportEvent(state, {
        type: "DECISION_SAVED",
        actorId: actor.id,
        assessmentId: assessment.id,
        referenceId: suggestionId,
        occurredAt: decidedAt
      });
      return { decision, summary: deriveReviewSummary(assessment.suggestions, assessment.decisions) } as const;
    });
    if ("conflict" in result) {
      return NextResponse.json(
        {
          code: "currentDecision" in result ? "REVISION_CONFLICT" : "STATE_CONFLICT",
          error: result.conflict,
          currentDecision: "currentDecision" in result ? result.currentDecision : null,
          summary: "summary" in result ? result.summary : null
        },
        { status: 409 }
      );
    }
    return NextResponse.json(result);
  } catch (error) {
    return routeError(error);
  }
}
