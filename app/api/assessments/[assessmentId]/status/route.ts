import { NextRequest, NextResponse } from "next/server";

import { assessmentService } from "@/lib/help-review/assessment-service";
import { routeError } from "@/lib/help-review/server-http";

export async function GET(request: NextRequest, context: { params: Promise<{ assessmentId: string }> }) {
  try {
    const { assessmentId } = await context.params;
    const projection = await assessmentService.processingStatus(request, assessmentId);
    return NextResponse.json({ assessment: projection });
  } catch (error) {
    return routeError(error);
  }
}
