import { NextRequest, NextResponse } from "next/server";

import { reviewService } from "@/lib/help-review/review-service";
import { assertSameOrigin, enforceRateLimit, routeError } from "@/lib/help-review/server-http";

export async function POST(request: NextRequest, context: { params: Promise<{ assessmentId: string }> }) {
  try {
    assertSameOrigin(request);
    enforceRateLimit(request, "playback-grant", { limit: 60 });
    const { assessmentId } = await context.params;
    const result = await reviewService.playbackGrant(request, assessmentId);
    if (!result) return NextResponse.json({ error: "Video unavailable." }, { status: 404 });
    return NextResponse.json(result);
  } catch (error) {
    return routeError(error);
  }
}
