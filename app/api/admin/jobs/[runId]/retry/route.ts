import { after, NextRequest, NextResponse } from "next/server";

import { adminJobsService } from "@/lib/help-review/admin-jobs-service";
import { clientProcessingRun } from "@/lib/help-review/public-projections";
import { assertSameOrigin, enforceRateLimit, routeError } from "@/lib/help-review/server-http";
import { dispatchProcessingRun, processingDispatchIsDurable } from "@/lib/help-review/processing-dispatcher";

export async function POST(request: NextRequest, context: { params: Promise<{ runId: string }> }) {
  try {
    assertSameOrigin(request);
    enforceRateLimit(request, "admin-processing-retry", { limit: 20 });
    const { runId } = await context.params;
    const result = await adminJobsService.retry(request, runId);
    if (result.blocked) return NextResponse.json({ error: result.reason }, { status: 409 });
    if (processingDispatchIsDurable()) await dispatchProcessingRun(result.run.id);
    else after(() => dispatchProcessingRun(result.run.id));
    return NextResponse.json({ run: clientProcessingRun(result.run) }, { status: 202 });
  } catch (error) {
    return routeError(error);
  }
}
