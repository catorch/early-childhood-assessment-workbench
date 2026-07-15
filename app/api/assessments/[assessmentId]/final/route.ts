import { NextRequest, NextResponse } from "next/server";

import { reviewService } from "@/lib/help-review/review-service";
import { routeError } from "@/lib/help-review/server-http";

export async function GET(request: NextRequest, context: { params: Promise<{ assessmentId: string }> }) {
  try {
    const { assessmentId } = await context.params;
    const result = await reviewService.finalProjection(request, assessmentId);
    return result.ok
      ? NextResponse.json(result.projection)
      : NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    return routeError(error);
  }
}
