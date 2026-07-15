import { describe, expect, it } from "vitest";

import { createSanitizedPilotState } from "./fixtures";
import type { PilotAssessment, StoredVideo } from "./models";
import { issuePlaybackGrant, validatePlaybackGrant } from "./playback-grants";

function assessmentWithVideo(): { assessment: PilotAssessment; video: StoredVideo } {
  const video: StoredVideo = {
    id: "video-1",
    storageKey: "video-1.mp4",
    originalFilename: "observation.mp4",
    contentType: "video/mp4",
    byteSize: 10,
    uploadedAt: "2026-07-14T12:00:00.000Z",
    uploadedById: "user-educator-1"
  };
  return {
    video,
    assessment: {
      id: "assessment-1",
      childId: "child-1001",
      educatorId: "user-educator-1",
      observationDate: "2026-07-14",
      status: "READY_FOR_REVIEW",
      video,
      runs: [],
      suggestions: [],
      decisions: [],
      finalizedAt: null,
      finalizedById: null,
      createdAt: "2026-07-14T12:00:00.000Z",
      updatedAt: "2026-07-14T12:00:00.000Z"
    }
  };
}

describe("purpose-bound playback grants", () => {
  it("persists metadata and validates only the intended viewer and asset", () => {
    const state = createSanitizedPilotState();
    const { assessment, video } = assessmentWithVideo();
    state.assessments.push(assessment);
    const viewer = state.users.find((user) => user.id === "user-educator-1")!;
    const issued = issuePlaybackGrant(state, assessment, viewer, new Date("2026-07-14T12:00:00.000Z"));

    expect(issued.record).toMatchObject({ assessmentId: assessment.id, videoAssetId: video.id, viewerId: viewer.id });
    expect(validatePlaybackGrant(state, issued.token, {
      assessmentId: assessment.id,
      videoAssetId: video.id,
      viewerId: viewer.id
    }, new Date("2026-07-14T12:04:59.000Z"))).not.toBeNull();
    expect(validatePlaybackGrant(state, issued.token, {
      assessmentId: assessment.id,
      videoAssetId: video.id,
      viewerId: "user-educator-2"
    }, new Date("2026-07-14T12:01:00.000Z"))).toBeNull();
  });

  it("rejects expiry, tampering, and a missing purpose record", () => {
    const state = createSanitizedPilotState();
    const { assessment, video } = assessmentWithVideo();
    const viewer = state.users.find((user) => user.id === "user-educator-1")!;
    const issued = issuePlaybackGrant(state, assessment, viewer, new Date("2026-07-14T12:00:00.000Z"));
    const expected = { assessmentId: assessment.id, videoAssetId: video.id, viewerId: viewer.id };

    expect(validatePlaybackGrant(state, `${issued.token}x`, expected, new Date("2026-07-14T12:01:00.000Z"))).toBeNull();
    expect(validatePlaybackGrant(state, issued.token, expected, new Date("2026-07-14T12:05:00.000Z"))).toBeNull();
    state.videoAccessGrants = [];
    expect(validatePlaybackGrant(state, issued.token, expected, new Date("2026-07-14T12:01:00.000Z"))).toBeNull();
  });
});
