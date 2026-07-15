import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

import type { PilotAssessment, PilotState, PilotUser, VideoAccessGrantRecord } from "./models";

export const PLAYBACK_GRANT_LIFETIME_SECONDS = 5 * 60;
export const REVIEW_PLAYBACK_PURPOSE = "EDUCATOR_REVIEW";

interface PlaybackGrantClaims {
  readonly version: 1;
  readonly grantId: string;
  readonly assessmentId: string;
  readonly videoAssetId: string;
  readonly viewerId: string;
  readonly purpose: typeof REVIEW_PLAYBACK_PURPOSE;
  readonly issuedAt: number;
  readonly expiresAt: number;
}

function secret(environment: NodeJS.ProcessEnv = process.env): string {
  const configured = environment.HELP_REVIEW_PLAYBACK_GRANT_SECRET ?? environment.HELP_REVIEW_SESSION_SECRET;
  if (configured) return configured;
  if (environment.NODE_ENV === "production") {
    throw new Error("HELP_REVIEW_PLAYBACK_GRANT_SECRET is required in production.");
  }
  return "help-review-local-playback-secret-not-for-production";
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

function signaturesMatch(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function issuePlaybackGrant(
  state: PilotState,
  assessment: PilotAssessment,
  viewer: PilotUser,
  now = new Date()
): { readonly token: string; readonly record: VideoAccessGrantRecord } {
  if (!assessment.video) throw new Error("A playback grant requires an available video.");
  const issuedAt = Math.floor(now.getTime() / 1_000);
  const claims: PlaybackGrantClaims = {
    version: 1,
    grantId: `grant-${randomUUID()}`,
    assessmentId: assessment.id,
    videoAssetId: assessment.video.id,
    viewerId: viewer.id,
    purpose: REVIEW_PLAYBACK_PURPOSE,
    issuedAt,
    expiresAt: issuedAt + PLAYBACK_GRANT_LIFETIME_SECONDS
  };
  const payload = Buffer.from(JSON.stringify(claims), "utf8").toString("base64url");
  const record: VideoAccessGrantRecord = {
    id: claims.grantId,
    assessmentId: claims.assessmentId,
    videoAssetId: claims.videoAssetId,
    viewerId: claims.viewerId,
    purpose: claims.purpose,
    issuedAt: new Date(claims.issuedAt * 1_000).toISOString(),
    expiresAt: new Date(claims.expiresAt * 1_000).toISOString()
  };
  (state.videoAccessGrants ??= []).push(record);
  return { token: `${payload}.${sign(payload)}`, record };
}

export function validatePlaybackGrant(
  state: PilotState,
  token: string | null,
  expected: {
    readonly assessmentId: string;
    readonly videoAssetId: string;
    readonly viewerId: string;
  },
  now = new Date()
): PlaybackGrantClaims | null {
  if (!token) return null;
  const [payload, suppliedSignature, extra] = token.split(".");
  if (!payload || !suppliedSignature || extra || !signaturesMatch(sign(payload), suppliedSignature)) return null;
  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Partial<PlaybackGrantClaims>;
    const current = Math.floor(now.getTime() / 1_000);
    if (
      claims.version !== 1 ||
      claims.purpose !== REVIEW_PLAYBACK_PURPOSE ||
      claims.assessmentId !== expected.assessmentId ||
      claims.videoAssetId !== expected.videoAssetId ||
      claims.viewerId !== expected.viewerId ||
      typeof claims.grantId !== "string" ||
      typeof claims.issuedAt !== "number" ||
      typeof claims.expiresAt !== "number" ||
      claims.issuedAt > current + 60 ||
      claims.expiresAt <= current ||
      claims.expiresAt - claims.issuedAt !== PLAYBACK_GRANT_LIFETIME_SECONDS
    ) return null;
    const record = state.videoAccessGrants?.find((candidate) => candidate.id === claims.grantId);
    if (
      !record ||
      record.assessmentId !== claims.assessmentId ||
      record.videoAssetId !== claims.videoAssetId ||
      record.viewerId !== claims.viewerId ||
      record.purpose !== claims.purpose ||
      new Date(record.expiresAt).getTime() <= now.getTime()
    ) return null;
    return claims as PlaybackGrantClaims;
  } catch {
    return null;
  }
}

export function playbackUrl(assessmentId: string, token: string): string {
  return `/api/assessments/${encodeURIComponent(assessmentId)}/video?token=${encodeURIComponent(token)}`;
}
