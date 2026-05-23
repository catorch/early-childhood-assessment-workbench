import { getCurrentPrompt, getVideoById } from "@/lib/data";
import { runMockAssessment } from "@/lib/ai/mock-provider";

export type RunVideoAssessmentInput = {
  videoId: string;
  promptVersionId?: string;
  forceRetry?: boolean;
};

export type RunVideoAssessmentResult = {
  aiRunId: string;
  status: "COMPLETED" | "FAILED";
  detectionCount: number;
  reviewFlagCount: number;
  diagnostics?: string;
};

export async function runVideoAssessment(input: RunVideoAssessmentInput): Promise<RunVideoAssessmentResult> {
  const video = getVideoById(input.videoId);
  const promptVersionId = input.promptVersionId ?? getCurrentPrompt().id;

  if (!video) {
    return {
      aiRunId: `run_missing_${Date.now()}`,
      status: "FAILED",
      detectionCount: 0,
      reviewFlagCount: 0,
      diagnostics: "Video not found"
    };
  }

  try {
    const output = await runMockAssessment(video.id, promptVersionId);
    const reviewFlagCount = output.detections.filter((detection) => detection.reviewFlags.length > 0).length;

    return {
      aiRunId: `run_${video.id}_${promptVersionId}`,
      status: "COMPLETED",
      detectionCount: output.detections.length,
      reviewFlagCount
    };
  } catch (error) {
    return {
      aiRunId: `run_failed_${video.id}_${Date.now()}`,
      status: "FAILED",
      detectionCount: 0,
      reviewFlagCount: 0,
      diagnostics: error instanceof Error ? error.message : "Unknown AI validation failure"
    };
  }
}
