import { NextRequest, NextResponse } from "next/server";

import { runVideoAssessment } from "@/lib/ai/run-video-assessment";

export async function POST(request: NextRequest, { params }: { params: Promise<{ videoId: string }> }) {
  const { videoId } = await params;
  const payload = await request.json().catch(() => ({}));
  const result = await runVideoAssessment({
    videoId,
    promptVersionId: typeof payload.promptVersionId === "string" ? payload.promptVersionId : undefined,
    forceRetry: Boolean(payload.forceRetry)
  });

  return NextResponse.json(result, { status: result.status === "COMPLETED" ? 200 : 422 });
}
