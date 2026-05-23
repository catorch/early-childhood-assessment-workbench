import { NextResponse } from "next/server";

import { detections, videos } from "@/lib/data";

export async function GET() {
  return NextResponse.json({
    data: videos
      .filter((video) => video.aiRunCount > 0)
      .map((video) => ({
        id: `run_${video.id}_${video.promptVersionId ?? "none"}`,
        videoId: video.id,
        promptVersionId: video.promptVersionId,
        status: video.status === "PROCESSING" ? "RUNNING" : video.status === "FAILED" ? "FAILED" : "COMPLETED",
        detectionCount: detections.filter((detection) => detection.videoId === video.id).length,
        modelName: "GPT-4o"
      }))
  });
}
