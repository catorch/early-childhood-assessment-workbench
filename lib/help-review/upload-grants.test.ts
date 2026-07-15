import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { issueUploadGrant, validateUploadGrant } from "./upload-grants";

const now = new Date("2026-07-14T20:00:00.000Z");
const claims = {
  assessmentId: "assessment-1",
  videoId: "video-1",
  actorId: "user-1",
  expectedRevision: 2,
  bucket: "private-video-bucket",
  objectName: "videos/video-1/source.mp4",
  originalFilename: "observation.mp4",
  contentType: "video/mp4" as const,
  byteSize: 64_256,
  durationSeconds: 3,
  checksumSha256: "a".repeat(64)
};

describe("GCS upload grants", () => {
  beforeEach(() => vi.stubEnv("HELP_REVIEW_UPLOAD_GRANT_SECRET", "upload-test-secret-that-is-long-and-distinct"));
  afterEach(() => vi.unstubAllEnvs());

  it("round-trips an assessment-bound, expiring upload intent", () => {
    const issued = issueUploadGrant(claims, now);

    expect(validateUploadGrant(issued.token, claims.assessmentId, now)).toMatchObject(claims);
    expect(validateUploadGrant(issued.token, "assessment-2", now)).toBeNull();
    expect(validateUploadGrant(issued.token, claims.assessmentId, new Date(now.getTime() + 15 * 60 * 1_000))).toBeNull();
  });

  it("rejects tampered and malformed tokens", () => {
    const { token } = issueUploadGrant(claims, now);
    const tampered = `${token.slice(0, -1)}${token.endsWith("a") ? "b" : "a"}`;

    expect(validateUploadGrant(tampered, claims.assessmentId, now)).toBeNull();
    expect(validateUploadGrant("not.a.valid.token", claims.assessmentId, now)).toBeNull();
  });
});
