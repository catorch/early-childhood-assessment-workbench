import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { reviewService } from "@/lib/help-review/review-service";
import { assertSameOrigin, enforceRateLimit, readJsonBody, routeError, validationError } from "@/lib/help-review/server-http";

const FinalizationMutationSchema = z.object({
  expectedRevision: z.number().int().nonnegative(),
  requestId: z.uuid()
}).strict();

export async function POST(request: NextRequest, context: { params: Promise<{ assessmentId: string }> }) {
  try {
    assertSameOrigin(request);
    enforceRateLimit(request, "assessment-finalize", { limit: 20 });
    const { assessmentId } = await context.params;
    const parsed = FinalizationMutationSchema.safeParse(await readJsonBody(request, 8 * 1024));
    if (!parsed.success) return validationError("The final confirmation is invalid. Refresh the summary and try again.");
    const result = await reviewService.finalize(request, assessmentId, parsed.data);
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
