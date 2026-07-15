import { after, NextRequest, NextResponse } from "next/server";

import { assessmentService } from "@/lib/help-review/assessment-service";
import { clientProcessingRun } from "@/lib/help-review/public-projections";
import { assertSameOrigin, enforceRateLimit, routeError, validationError } from "@/lib/help-review/server-http";
import { dispatchProcessingRun, processingDispatchIsDurable } from "@/lib/help-review/processing-dispatcher";

export async function POST(request: NextRequest, context: { params: Promise<{ assessmentId: string }> }) {
  try {
    assertSameOrigin(request);
    enforceRateLimit(request, "assessment-process", { limit: 20 });
    const { assessmentId } = await context.params;
    const result = await assessmentService.startProcessing(request, assessmentId);
    if (result.blocked) return validationError(result.reason);
    if (processingDispatchIsDurable()) await dispatchProcessingRun(result.run.id);
    else after(() => dispatchProcessingRun(result.run.id));
    return NextResponse.json({ run: clientProcessingRun(result.run) }, { status: 202 });
  } catch (error) {
    return routeError(error);
  }
}
