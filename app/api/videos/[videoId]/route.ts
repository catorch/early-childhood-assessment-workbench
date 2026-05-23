import { NextResponse } from "next/server";

import { getChildForVideo, getDetectionsForVideo, getVideoById } from "@/lib/data";

export async function GET(_request: Request, { params }: { params: Promise<{ videoId: string }> }) {
  const { videoId } = await params;
  const video = getVideoById(videoId);

  if (!video) {
    return NextResponse.json({ error: "Video not found" }, { status: 404 });
  }

  return NextResponse.json({
    data: {
      ...video,
      child: getChildForVideo(video),
      latestAiRun: {
        id: `run_${video.id}_${video.promptVersionId ?? "none"}`,
        promptVersionId: video.promptVersionId,
        status: video.status === "FAILED" ? "FAILED" : video.status === "PROCESSING" ? "RUNNING" : "COMPLETED",
        detectionCount: video.detectionCount
      },
      detections: getDetectionsForVideo(video.id)
    }
  });
}
