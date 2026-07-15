import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { get, head, type PutBlobResult } from "@vercel/blob";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  configuredGcsBucket,
  createGcsResumableUpload,
  deleteGcsObject,
  inspectGcsObject
} from "@/lib/help-review/gcs-storage";
import {
  assertRequestBodyLimit,
  assertSameOrigin,
  enforceRateLimit,
  publicRequestOrigin,
  readJsonBody,
  routeError,
  validationError
} from "@/lib/help-review/server-http";
import {
  removePilotUpload,
  uploadDirectory
} from "@/lib/help-review/server-store";
import { videoAssetService } from "@/lib/help-review/video-asset-service";
import { clientVideo } from "@/lib/help-review/public-projections";
import { issueUploadGrant, validateUploadGrant } from "@/lib/help-review/upload-grants";
import {
  hasExpectedVideoSignature,
  VIDEO_CONTENT_TYPES,
  VIDEO_MAX_BYTES,
  VIDEO_MAX_DURATION_SECONDS,
  type VideoContentType
} from "@/lib/help-review/video-policy";

const sandboxContentTypes = VIDEO_CONTENT_TYPES;
const sandboxContentTypeSet = new Set<string>(sandboxContentTypes);
const sandboxMaxBytes = VIDEO_MAX_BYTES;
const sandboxMaxDurationSeconds = VIDEO_MAX_DURATION_SECONDS;

const ClientUploadPayloadSchema = z.object({
  assessmentId: z.string().min(1),
  videoId: z.string().regex(/^video-[0-9a-f]{8}-[0-9a-f]{4}-[4-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i),
  originalFilename: z.string().trim().min(1).max(255),
  contentType: z.enum(sandboxContentTypes),
  byteSize: z.number().int().positive().max(sandboxMaxBytes),
  durationSeconds: z.number().int().positive().max(sandboxMaxDurationSeconds),
  checksumSha256: z.string().regex(/^[a-f0-9]{64}$/)
}).strict();

const TokenPayloadSchema = ClientUploadPayloadSchema.extend({
  actorId: z.string().min(1),
  videoId: z.string().min(1),
  expectedRevision: z.number().int().nonnegative()
}).strict();

const GcsInitiatePayloadSchema = ClientUploadPayloadSchema.extend({
  action: z.literal("initiate")
}).strict();

const GcsCompletePayloadSchema = z.object({
  action: z.literal("complete"),
  token: z.string().min(1).max(8 * 1024)
}).strict();

function blobUploadsEnabled(): boolean {
  return process.env.HELP_REVIEW_VIDEO_ADAPTER === "vercel-blob";
}

function gcsUploadsEnabled(): boolean {
  return process.env.HELP_REVIEW_VIDEO_ADAPTER === "gcs";
}

function objectExtension(contentType: VideoContentType): string {
  if (contentType === "video/webm") return ".webm";
  if (contentType === "video/quicktime") return ".mov";
  return ".mp4";
}

async function handleGcsUpload(request: NextRequest, assessmentId: string): Promise<NextResponse> {
  const body = await readJsonBody(request, 16 * 1024);
  const completion = GcsCompletePayloadSchema.safeParse(body);
  if (completion.success) {
    const claims = validateUploadGrant(completion.data.token, assessmentId);
    if (!claims || claims.bucket !== configuredGcsBucket()) return validationError("The upload grant is invalid or expired.");
    const authorization = await videoAssetService.authorizeUpload(request, assessmentId);
    if (authorization.blocked || authorization.actorId !== claims.actorId) {
      return validationError(authorization.blocked ? authorization.reason : "The upload grant belongs to another session.");
    }
    let object;
    try {
      object = await inspectGcsObject(claims.objectName, null, claims.bucket);
      const expectedMetadata = object.metadata;
      if (
        object.contentType !== claims.contentType ||
        object.byteSize !== claims.byteSize ||
        !object.crc32c ||
        expectedMetadata.helpReviewVideoId !== claims.videoId ||
        expectedMetadata.helpReviewAssessmentId !== claims.assessmentId ||
        expectedMetadata.helpReviewSha256 !== claims.checksumSha256 ||
        !hasExpectedVideoSignature(object.firstBytes, claims.contentType)
      ) throw new Error("The completed Google Cloud upload metadata is invalid.");
    } catch (error) {
      await deleteGcsObject(claims.objectName, claims.bucket).catch(() => undefined);
      throw error;
    }
    const video = {
      id: claims.videoId,
      storageProvider: "gcs" as const,
      storageKey: claims.objectName,
      storageBucket: claims.bucket,
      storageGeneration: object.generation,
      originalFilename: claims.originalFilename,
      contentType: claims.contentType,
      byteSize: object.byteSize,
      durationSeconds: claims.durationSeconds,
      checksumSha256: claims.checksumSha256,
      checksumCrc32c: object.crc32c,
      uploadedAt: new Date().toISOString(),
      uploadedById: claims.actorId
    };
    const result = await videoAssetService.commitCompletedUpload({
      assessmentId,
      actorId: claims.actorId,
      expectedRevision: claims.expectedRevision,
      video
    });
    if (result.blocked) {
      await deleteGcsObject(claims.objectName, claims.bucket, object.generation).catch(() => undefined);
      return validationError(result.reason);
    }
    if (result.oldStorageKey && result.oldStorageKey !== claims.objectName) {
      await deleteGcsObject(result.oldStorageKey, claims.bucket).catch(() => undefined);
    }
    return NextResponse.json({ video: clientVideo(video) });
  }

  const initiation = GcsInitiatePayloadSchema.safeParse(body);
  if (!initiation.success || initiation.data.assessmentId !== assessmentId) {
    return validationError("The upload request is invalid.");
  }
  const authorization = await videoAssetService.authorizeUpload(request, assessmentId);
  if (authorization.blocked) return validationError(authorization.reason);
  const bucket = configuredGcsBucket();
  const objectName = `videos/${initiation.data.videoId}/${randomUUID()}${objectExtension(initiation.data.contentType)}`;
  const issued = issueUploadGrant({
    assessmentId,
    videoId: initiation.data.videoId,
    actorId: authorization.actorId,
    expectedRevision: authorization.expectedRevision,
    bucket,
    objectName,
    originalFilename: initiation.data.originalFilename,
    contentType: initiation.data.contentType,
    byteSize: initiation.data.byteSize,
    durationSeconds: initiation.data.durationSeconds,
    checksumSha256: initiation.data.checksumSha256
  });
  const uploadUrl = await createGcsResumableUpload({
    objectName,
    contentType: initiation.data.contentType,
    byteSize: initiation.data.byteSize,
    origin: publicRequestOrigin(request),
    metadata: {
      helpReviewVideoId: initiation.data.videoId,
      helpReviewAssessmentId: assessmentId,
      helpReviewSha256: initiation.data.checksumSha256
    }
  });
  return NextResponse.json({ uploadUrl, completionToken: issued.token }, { status: 201 });
}

async function verifiedBlobChecksum(pathname: string, contentType: VideoContentType): Promise<string> {
  const result = await get(pathname, { access: "private", useCache: false });
  if (!result || result.statusCode !== 200 || !result.stream) {
    throw new Error("The completed upload bytes are unavailable.");
  }
  const bytes = new Uint8Array(await new Response(result.stream).arrayBuffer());
  if (!hasExpectedVideoSignature(bytes, contentType)) {
    throw new Error("The completed upload does not match its declared video container.");
  }
  return createHash("sha256").update(bytes).digest("hex");
}

async function recordCompletedBlob(
  assessmentId: string,
  blob: PutBlobResult,
  tokenPayload: string | null | undefined
): Promise<void> {
  const parsed = TokenPayloadSchema.safeParse(JSON.parse(tokenPayload ?? "{}"));
  if (!parsed.success || parsed.data.assessmentId !== assessmentId) {
    throw new Error("The completed upload token is invalid.");
  }
  const expectedPrefix = `help-review/${parsed.data.videoId}/`;
  if (!blob.pathname.startsWith(expectedPrefix)) throw new Error("The completed upload path is invalid.");
  const metadata = await head(blob.pathname);
  const contentType = metadata.contentType ?? parsed.data.contentType;
  if (
    metadata.size <= 0 ||
    metadata.size > sandboxMaxBytes ||
    !sandboxContentTypeSet.has(contentType)
  ) {
    await removePilotUpload(blob.pathname);
    throw new Error("The completed upload metadata is invalid.");
  }
  let checksumSha256: string;
  try {
    checksumSha256 = await verifiedBlobChecksum(blob.pathname, contentType as VideoContentType);
  } catch (error) {
    await removePilotUpload(blob.pathname);
    throw error;
  }
  if (checksumSha256 !== parsed.data.checksumSha256) {
    await removePilotUpload(blob.pathname);
    throw new Error("The completed upload checksum is invalid.");
  }

  const now = new Date().toISOString();
  const result = await videoAssetService.commitCompletedUpload({
    assessmentId,
    actorId: parsed.data.actorId,
    expectedRevision: parsed.data.expectedRevision,
    video: {
      id: parsed.data.videoId,
      storageProvider: "vercel-blob",
      storageKey: blob.pathname,
      originalFilename: parsed.data.originalFilename,
      contentType,
      byteSize: metadata.size,
      durationSeconds: parsed.data.durationSeconds,
      checksumSha256,
      uploadedAt: now,
      uploadedById: parsed.data.actorId
    }
  });

  if (result.blocked) {
    await removePilotUpload(blob.pathname);
    return;
  }
  if (result.oldStorageKey && result.oldStorageKey !== blob.pathname) {
    await removePilotUpload(result.oldStorageKey);
  }
}

async function handleBlobUpload(
  request: NextRequest,
  assessmentId: string
): Promise<NextResponse> {
  const body = (await readJsonBody(request, 64 * 1024)) as HandleUploadBody;
  const response = await handleUpload({
    body,
    request,
    onBeforeGenerateToken: async (pathname, clientPayload) => {
      const parsed = ClientUploadPayloadSchema.safeParse(JSON.parse(clientPayload ?? "{}"));
      if (!parsed.success || parsed.data.assessmentId !== assessmentId) {
        throw new Error("The upload request is invalid.");
      }
      const expectedPrefix = `help-review/${parsed.data.videoId}/`;
      if (!pathname.startsWith(expectedPrefix) || pathname.includes("..")) {
        throw new Error("The upload path is invalid.");
      }
      const authorization = await videoAssetService.authorizeUpload(request, assessmentId);
      if (authorization.blocked) throw new Error(authorization.reason);
      return {
        allowedContentTypes: [...sandboxContentTypes],
        maximumSizeInBytes: sandboxMaxBytes,
        addRandomSuffix: false,
        tokenPayload: JSON.stringify({
          ...parsed.data,
          actorId: authorization.actorId,
          expectedRevision: authorization.expectedRevision
        })
      };
    },
    onUploadCompleted: async ({ blob, tokenPayload }) => {
      await recordCompletedBlob(assessmentId, blob, tokenPayload);
    }
  });
  return NextResponse.json(response);
}

async function handleLocalUpload(
  request: NextRequest,
  assessmentId: string
): Promise<NextResponse> {
  const authorization = await videoAssetService.authorizeUpload(request, assessmentId);
  if (authorization.blocked) return validationError(authorization.reason);
  assertRequestBodyLimit(request, sandboxMaxBytes + 64 * 1024);
  const formData = await request.formData();
  const candidate = formData.get("video");
  const metadata = ClientUploadPayloadSchema.omit({
    assessmentId: true,
    videoId: true,
    originalFilename: true,
    contentType: true,
    byteSize: true
  }).safeParse({
    durationSeconds: Number(formData.get("durationSeconds")),
    checksumSha256: formData.get("checksumSha256")
  });
  if (!(candidate instanceof File)) return validationError("Choose one video to upload.");
  if (!metadata.success) return validationError("The video metadata could not be verified.");
  if (!sandboxContentTypeSet.has(candidate.type)) {
    return validationError("The sandbox accepts MP4, WebM, or MOV video.");
  }
  if (candidate.size === 0 || candidate.size > sandboxMaxBytes) {
    return validationError("The sandbox video must be larger than 0 bytes and no more than 100 MB.");
  }

  const bytes = Buffer.from(await candidate.arrayBuffer());
  if (!hasExpectedVideoSignature(bytes, candidate.type as VideoContentType)) {
    return validationError("The file contents do not match the selected video type.");
  }
  if (createHash("sha256").update(bytes).digest("hex") !== metadata.data.checksumSha256) {
    return validationError("The uploaded video checksum did not match.");
  }
  const storageKey = `${randomUUID()}${path.extname(candidate.name).toLowerCase()}`;
  await mkdir(uploadDirectory(), { recursive: true });
  await writeFile(path.join(uploadDirectory(), storageKey), bytes);

  let result;
  try {
    result = await videoAssetService.commitForRequest(request, assessmentId, {
        id: `video-${randomUUID()}`,
        storageProvider: "local",
        storageKey,
        originalFilename: candidate.name,
        contentType: candidate.type,
        byteSize: candidate.size,
        durationSeconds: metadata.data.durationSeconds,
        checksumSha256: metadata.data.checksumSha256,
        uploadedAt: new Date().toISOString(),
        uploadedById: authorization.actorId
    });
  } catch (error) {
    await removePilotUpload(storageKey);
    throw error;
  }
  if (result.blocked) {
    await removePilotUpload(storageKey);
    return validationError(result.reason);
  }
  if (result.oldStorageKey && result.oldStorageKey !== result.video.storageKey) {
    await removePilotUpload(result.oldStorageKey);
  }
  return NextResponse.json({ video: clientVideo(result.video) });
}

export async function GET(request: NextRequest, context: { params: Promise<{ assessmentId: string }> }) {
  try {
    const { assessmentId } = await context.params;
    return NextResponse.json(await videoAssetService.projection(
      request,
      assessmentId,
      gcsUploadsEnabled() ? "gcs" : blobUploadsEnabled() ? "blob" : "server"
    ));
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ assessmentId: string }> }) {
  try {
    assertSameOrigin(request);
    enforceRateLimit(request, "assessment-upload", { limit: 30 });
    const { assessmentId } = await context.params;
    if (gcsUploadsEnabled()) return handleGcsUpload(request, assessmentId);
    return blobUploadsEnabled() ? await handleBlobUpload(request, assessmentId) : await handleLocalUpload(request, assessmentId);
  } catch (error) {
    return routeError(error);
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ assessmentId: string }> }) {
  try {
    assertSameOrigin(request);
    enforceRateLimit(request, "assessment-upload-remove", { limit: 30 });
    const { assessmentId } = await context.params;
    const result = await videoAssetService.remove(request, assessmentId);
    if (result.blocked) return validationError(result.reason);
    if (result.storageKey) await removePilotUpload(result.storageKey);
    return NextResponse.json({ removed: true });
  } catch (error) {
    return routeError(error);
  }
}
