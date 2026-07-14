import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { head, type PutBlobResult } from "@vercel/blob";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import type { PilotState, PilotUser, StoredVideo } from "@/lib/help-review/models";
import { activeUserFromState } from "@/lib/help-review/server-auth";
import { assertSameOrigin, routeError, validationError } from "@/lib/help-review/server-http";
import { requireAssessment } from "@/lib/help-review/server-workflow";
import {
  readPilotState,
  removePilotUpload,
  updatePilotState,
  uploadDirectory
} from "@/lib/help-review/server-store";

const sandboxContentTypes = ["video/mp4", "video/webm", "video/quicktime"] as const;
const sandboxContentTypeSet = new Set<string>(sandboxContentTypes);
const sandboxMaxBytes = 100 * 1024 * 1024;

const ClientUploadPayloadSchema = z.object({
  assessmentId: z.string().min(1),
  originalFilename: z.string().trim().min(1).max(255),
  contentType: z.enum(sandboxContentTypes),
  byteSize: z.number().int().positive().max(sandboxMaxBytes)
}).strict();

const TokenPayloadSchema = ClientUploadPayloadSchema.extend({
  actorId: z.string().min(1),
  videoId: z.string().min(1),
  expectedRevision: z.number().int().nonnegative()
}).strict();

function blobUploadsEnabled(): boolean {
  return process.env.HELP_REVIEW_VIDEO_ADAPTER === "vercel-blob";
}

function validateUploadEligibility(state: PilotState, actor: PilotUser, assessmentId: string): string | null {
  const assessment = requireAssessment(state, actor, assessmentId);
  const child = state.children.find((candidate) => candidate.id === assessment.childId && candidate.isActive);
  if (!child?.processingAllowed) return "Processing permission is not approved for this child.";
  if (!(["DRAFT", "FAILED"] as const).includes(assessment.status as "DRAFT" | "FAILED")) {
    return `A video cannot be replaced while the assessment is ${assessment.status.toLowerCase()}.`;
  }
  return null;
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
  const expectedPrefix = `help-review/${assessmentId}/`;
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

  const result = await updatePilotState((state) => {
    const actor = state.users.find(
      (candidate) => candidate.id === parsed.data.actorId && candidate.isActive
    );
    const activeAccess = state.access.some(
      (provision) => provision.userId === actor?.id && provision.active
    );
    if (!actor || !activeAccess) {
      return { blocked: true as const, reason: "Pilot access changed before upload completion." };
    }
    const reason = validateUploadEligibility(state, actor, assessmentId);
    if (reason) return { blocked: true as const, reason };
    const assessment = requireAssessment(state, actor, assessmentId);
    if (
      assessment.video?.id === parsed.data.videoId &&
      assessment.video.storageKey === blob.pathname
    ) {
      return { blocked: false as const, oldStorageKey: null };
    }
    if ((assessment.revision ?? 0) !== parsed.data.expectedRevision) {
      return { blocked: true as const, reason: "The assessment changed before upload completion." };
    }
    const now = new Date().toISOString();
    const oldStorageKey = assessment.video?.storageKey ?? null;
    assessment.video = {
      id: parsed.data.videoId,
      storageKey: blob.pathname,
      originalFilename: parsed.data.originalFilename,
      contentType,
      byteSize: metadata.size,
      uploadedAt: now,
      uploadedById: actor.id
    };
    assessment.status = "DRAFT";
    assessment.updatedAt = now;
    assessment.revision = (assessment.revision ?? 0) + 1;
    return { blocked: false as const, oldStorageKey };
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
  const body = (await request.json()) as HandleUploadBody;
  const response = await handleUpload({
    body,
    request,
    onBeforeGenerateToken: async (pathname, clientPayload) => {
      const parsed = ClientUploadPayloadSchema.safeParse(JSON.parse(clientPayload ?? "{}"));
      if (!parsed.success || parsed.data.assessmentId !== assessmentId) {
        throw new Error("The upload request is invalid.");
      }
      const expectedPrefix = `help-review/${assessmentId}/`;
      if (!pathname.startsWith(expectedPrefix) || pathname.includes("..")) {
        throw new Error("The upload path is invalid.");
      }
      const state = await readPilotState();
      const actor = activeUserFromState(request, state);
      const reason = validateUploadEligibility(state, actor, assessmentId);
      if (reason) throw new Error(reason);
      const assessment = requireAssessment(state, actor, assessmentId);
      return {
        allowedContentTypes: [...sandboxContentTypes],
        maximumSizeInBytes: sandboxMaxBytes,
        addRandomSuffix: false,
        tokenPayload: JSON.stringify({
          ...parsed.data,
          actorId: actor.id,
          videoId: `video-${randomUUID()}`,
          expectedRevision: assessment.revision ?? 0
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
  const currentState = await readPilotState();
  const currentActor = activeUserFromState(request, currentState);
  const reason = validateUploadEligibility(currentState, currentActor, assessmentId);
  if (reason) return validationError(reason);
  const formData = await request.formData();
  const candidate = formData.get("video");
  if (!(candidate instanceof File)) return validationError("Choose one video to upload.");
  if (!sandboxContentTypeSet.has(candidate.type)) {
    return validationError("The sandbox accepts MP4, WebM, or MOV video.");
  }
  if (candidate.size === 0 || candidate.size > sandboxMaxBytes) {
    return validationError("The sandbox video must be larger than 0 bytes and no more than 100 MB.");
  }

  const storageKey = `${randomUUID()}${path.extname(candidate.name).toLowerCase()}`;
  await mkdir(uploadDirectory(), { recursive: true });
  await writeFile(path.join(uploadDirectory(), storageKey), Buffer.from(await candidate.arrayBuffer()));

  let result:
    | { blocked: false; video: StoredVideo; oldStorageKey: string | null }
    | { blocked: true; reason: string };
  try {
    result = await updatePilotState((state) => {
      const actor = activeUserFromState(request, state);
      const blockedReason = validateUploadEligibility(state, actor, assessmentId);
      if (blockedReason) return { blocked: true as const, reason: blockedReason };
      const assessment = requireAssessment(state, actor, assessmentId);
      const now = new Date().toISOString();
      const oldStorageKey = assessment.video?.storageKey ?? null;
      assessment.video = {
        id: `video-${randomUUID()}`,
        storageKey,
        originalFilename: candidate.name,
        contentType: candidate.type,
        byteSize: candidate.size,
        uploadedAt: now,
        uploadedById: actor.id
      };
      assessment.status = "DRAFT";
      assessment.updatedAt = now;
      assessment.revision = (assessment.revision ?? 0) + 1;
      return { blocked: false as const, video: assessment.video, oldStorageKey };
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
  return NextResponse.json({ video: result.video });
}

export async function GET(request: NextRequest, context: { params: Promise<{ assessmentId: string }> }) {
  try {
    const { assessmentId } = await context.params;
    const state = await readPilotState();
    const actor = activeUserFromState(request, state);
    const assessment = requireAssessment(state, actor, assessmentId);
    return NextResponse.json({
      assessment,
      video: assessment.video,
      uploadMode: blobUploadsEnabled() ? "blob" : "server"
    });
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ assessmentId: string }> }) {
  try {
    assertSameOrigin(request);
    const { assessmentId } = await context.params;
    return blobUploadsEnabled()
      ? await handleBlobUpload(request, assessmentId)
      : await handleLocalUpload(request, assessmentId);
  } catch (error) {
    return routeError(error);
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ assessmentId: string }> }) {
  try {
    assertSameOrigin(request);
    const { assessmentId } = await context.params;
    const result = await updatePilotState((state) => {
      const actor = activeUserFromState(request, state);
      const assessment = requireAssessment(state, actor, assessmentId);
      if (!["DRAFT", "FAILED"].includes(assessment.status)) {
        return { blocked: true as const, reason: "This video can no longer be removed." };
      }
      const storageKey = assessment.video?.storageKey ?? null;
      assessment.video = null;
      assessment.runs = [];
      assessment.suggestions = [];
      assessment.decisions = [];
      assessment.status = "DRAFT";
      assessment.updatedAt = new Date().toISOString();
      assessment.revision = (assessment.revision ?? 0) + 1;
      return { blocked: false as const, storageKey };
    });
    if (result.blocked) return validationError(result.reason);
    if (result.storageKey) await removePilotUpload(result.storageKey);
    return NextResponse.json({ removed: true });
  } catch (error) {
    return routeError(error);
  }
}
