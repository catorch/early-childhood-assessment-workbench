import { NextRequest, NextResponse } from "next/server";

import { createFinalRecordPdf } from "@/lib/help-review/final-record-pdf";
import { reviewService } from "@/lib/help-review/review-service";
import { routeError } from "@/lib/help-review/server-http";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ assessmentId: string }> }
) {
  try {
    const { assessmentId } = await context.params;
    const result = await reviewService.finalProjection(request, assessmentId);
    if (!result.ok) return NextResponse.json(result.body, { status: result.status });
    const pdf = await createFinalRecordPdf(result.projection);
    const identifier = result.projection.child.externalChildId.replace(/[^a-zA-Z0-9_-]+/g, "-");
    return new NextResponse(Buffer.from(pdf), {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": `attachment; filename="help-assessment-${identifier}-${result.projection.assessment.observationDate}.pdf"`,
        "Content-Type": "application/pdf"
      }
    });
  } catch (error) {
    return routeError(error);
  }
}
