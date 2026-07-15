import { createHmac, timingSafeEqual } from "node:crypto";

import type { VideoContentType } from "./video-policy";

export const UPLOAD_GRANT_LIFETIME_SECONDS = 15 * 60;

export interface UploadGrantClaims {
  readonly version: 1;
  readonly assessmentId: string;
  readonly videoId: string;
  readonly actorId: string;
  readonly expectedRevision: number;
  readonly bucket: string;
  readonly objectName: string;
  readonly originalFilename: string;
  readonly contentType: VideoContentType;
  readonly byteSize: number;
  readonly durationSeconds: number;
  readonly checksumSha256: string;
  readonly issuedAt: number;
  readonly expiresAt: number;
}

function uploadSecret(environment: NodeJS.ProcessEnv = process.env): string {
  const configured = environment.HELP_REVIEW_UPLOAD_GRANT_SECRET ?? environment.HELP_REVIEW_SESSION_SECRET;
  if (configured) return configured;
  if (environment.NODE_ENV === "production") {
    throw new Error("HELP_REVIEW_UPLOAD_GRANT_SECRET is required in production.");
  }
  return "help-review-local-upload-secret-not-for-production";
}

function signature(payload: string): string {
  return createHmac("sha256", uploadSecret()).update(payload).digest("base64url");
}

function signatureMatches(expected: string, actual: string): boolean {
  const left = Buffer.from(expected);
  const right = Buffer.from(actual);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function issueUploadGrant(
  claims: Omit<UploadGrantClaims, "version" | "issuedAt" | "expiresAt">,
  now = new Date()
): { readonly token: string; readonly claims: UploadGrantClaims } {
  const issuedAt = Math.floor(now.getTime() / 1_000);
  const complete: UploadGrantClaims = {
    version: 1,
    ...claims,
    issuedAt,
    expiresAt: issuedAt + UPLOAD_GRANT_LIFETIME_SECONDS
  };
  const payload = Buffer.from(JSON.stringify(complete), "utf8").toString("base64url");
  return { token: `${payload}.${signature(payload)}`, claims: complete };
}

export function validateUploadGrant(
  token: string,
  expectedAssessmentId: string,
  now = new Date()
): UploadGrantClaims | null {
  const [payload, suppliedSignature, extra] = token.split(".");
  if (!payload || !suppliedSignature || extra || !signatureMatches(signature(payload), suppliedSignature)) return null;
  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as UploadGrantClaims;
    const current = Math.floor(now.getTime() / 1_000);
    if (
      claims.version !== 1 ||
      claims.assessmentId !== expectedAssessmentId ||
      typeof claims.videoId !== "string" ||
      typeof claims.actorId !== "string" ||
      !Number.isInteger(claims.expectedRevision) ||
      typeof claims.bucket !== "string" ||
      typeof claims.objectName !== "string" ||
      typeof claims.originalFilename !== "string" ||
      !["video/mp4", "video/webm", "video/quicktime"].includes(claims.contentType) ||
      !Number.isSafeInteger(claims.byteSize) ||
      !Number.isInteger(claims.durationSeconds) ||
      !/^[a-f0-9]{64}$/.test(claims.checksumSha256) ||
      claims.issuedAt > current + 60 ||
      claims.expiresAt <= current ||
      claims.expiresAt - claims.issuedAt !== UPLOAD_GRANT_LIFETIME_SECONDS
    ) return null;
    return claims;
  } catch {
    return null;
  }
}
