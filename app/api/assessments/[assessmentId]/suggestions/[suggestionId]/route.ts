import { NextRequest, NextResponse } from "next/server";

import { ReviewDecisionMutationSchema } from "@/lib/help-review/domain";
import { reviewService } from "@/lib/help-review/review-service";
import { assertSameOrigin, enforceRateLimit, readJsonBody, routeError, validationError } from "@/lib/help-review/server-http";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ assessmentId: string; suggestionId: string }> }
) {
  try {
    assertSameOrigin(request);
    await enforceRateLimit(request, "review-decision", { limit: 120 });
    const { assessmentId, suggestionId } = await context.params;
    const parsed = ReviewDecisionMutationSchema.safeParse(await readJsonBody(request, 16 * 1024));
    if (!parsed.success) return validationError(parsed.error.issues[0]?.message ?? "The review decision is invalid.");
    const result = await reviewService.saveDecision(request, assessmentId, suggestionId, parsed.data);
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
