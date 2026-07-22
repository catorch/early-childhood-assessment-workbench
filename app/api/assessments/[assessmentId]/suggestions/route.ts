import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { PrimaryCreditSchema } from "@/lib/help-review/domain";
import { reviewService } from "@/lib/help-review/review-service";
import { assertSameOrigin, enforceRateLimit, readJsonBody, routeError, validationError } from "@/lib/help-review/server-http";

const ManualSkillSchema = z
  .object({
    sourceSkillId: z.string().min(1).max(200),
    finalCredit: PrimaryCreditSchema,
    concernFlag: z.boolean().default(false),
    note: z.string().trim().max(1_000).nullable()
  })
  .strict();

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ assessmentId: string }> }
) {
  try {
    assertSameOrigin(request);
    await enforceRateLimit(request, "review-decision", { limit: 120 });
    const { assessmentId } = await context.params;
    const parsed = ManualSkillSchema.safeParse(await readJsonBody(request, 16 * 1024));
    if (!parsed.success) return validationError(parsed.error.issues[0]?.message ?? "The added skill is invalid.");
    const result = await reviewService.addManualSkill(request, assessmentId, parsed.data);
    if ("invalid" in result) return validationError(result.invalid ?? "The added skill is invalid.");
    if ("conflict" in result) {
      return NextResponse.json(
        {
          code: "STATE_CONFLICT",
          error: result.conflict,
          existingSuggestionId: "existingSuggestionId" in result ? result.existingSuggestionId : null
        },
        { status: 409 }
      );
    }
    return NextResponse.json(result);
  } catch (error) {
    return routeError(error);
  }
}
