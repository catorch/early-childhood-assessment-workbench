import type {
  ClientProcessingRun,
  ClientVideo,
  PilotUser,
  ProcessingRun,
  SessionUser,
  StoredVideo
} from "./models";

export function clientVideo(video: StoredVideo | null): ClientVideo | null {
  if (!video) return null;
  return {
    id: video.id,
    originalFilename: video.originalFilename,
    contentType: video.contentType,
    byteSize: video.byteSize,
    durationSeconds: video.durationSeconds ?? null,
    uploadedAt: video.uploadedAt
  };
}

export function sessionUser(user: PilotUser): SessionUser {
  return {
    id: user.id,
    displayName: user.displayName,
    role: user.role
  };
}

export function clientProcessingRun(run: ProcessingRun): ClientProcessingRun {
  return {
    id: run.id,
    attempt: run.attempt,
    status: run.status,
    requestedAt: run.requestedAt,
    startedAt: run.startedAt ?? null,
    completedAt: run.completedAt,
    safeErrorCode: run.safeErrorCode,
    retryOfRunId: run.retryOfRunId ?? null
  };
}
