import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { NextRequest, NextResponse } from "next/server";

import type { StoredVideo } from "@/lib/help-review/models";
import { activeUserFromState } from "@/lib/help-review/server-auth";
import { assertSameOrigin, routeError, validationError } from "@/lib/help-review/server-http";
import { requireAssessment } from "@/lib/help-review/server-workflow";
import { readPilotState, removePilotUpload, updatePilotState, uploadDirectory } from "@/lib/help-review/server-store";

const sandboxContentTypes = new Set(["video/mp4", "video/webm", "video/quicktime"]);
const sandboxMaxBytes = 100 * 1024 * 1024;

export async function GET(request: NextRequest, context: { params: Promise<{ assessmentId: string }> }) {
  try {
    const { assessmentId } = await context.params;
    const state = await readPilotState();
    const actor = activeUserFromState(request, state);
    const assessment = requireAssessment(state, actor, assessmentId);
    return NextResponse.json({ assessment, video: assessment.video });
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ assessmentId: string }> }) {
  try {
    assertSameOrigin(request);
    const { assessmentId } = await context.params;
    const currentState = await readPilotState();
    const currentActor = activeUserFromState(request, currentState);
    const currentAssessment = requireAssessment(currentState, currentActor, assessmentId);
    const currentChild = currentState.children.find((child) => child.id === currentAssessment.childId && child.isActive);
    if (!currentChild?.processingAllowed) {
      return validationError("Processing permission is not approved for this child.");
    }
    if (!["DRAFT", "FAILED"].includes(currentAssessment.status)) {
      return validationError(`A video cannot be replaced while the assessment is ${currentAssessment.status.toLowerCase()}.`);
    }
    const formData = await request.formData();
    const candidate = formData.get("video");
    if (!(candidate instanceof File)) return validationError("Choose one video to upload.");
    if (!sandboxContentTypes.has(candidate.type)) return validationError("The sandbox accepts MP4, WebM, or MOV video.");
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
        const assessment = requireAssessment(state, actor, assessmentId);
        const child = state.children.find((candidate) => candidate.id === assessment.childId && candidate.isActive);
        if (!child?.processingAllowed) {
          return { blocked: true as const, reason: "Processing permission changed before the upload completed." };
        }
        if (!["DRAFT", "FAILED"].includes(assessment.status)) {
          return { blocked: true as const, reason: `A video cannot be replaced while the assessment is ${assessment.status.toLowerCase()}.` };
        }
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
