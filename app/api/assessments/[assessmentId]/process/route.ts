import { randomUUID } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import { activeUserFromState } from "@/lib/help-review/server-auth";
import { recordSupportEvent } from "@/lib/help-review/server-events";
import { assertSameOrigin, routeError, validationError } from "@/lib/help-review/server-http";
import { requireAssessment } from "@/lib/help-review/server-workflow";
import { updatePilotState } from "@/lib/help-review/server-store";

export async function POST(request: NextRequest, context: { params: Promise<{ assessmentId: string }> }) {
  try {
    assertSameOrigin(request);
    const { assessmentId } = await context.params;
    const result = await updatePilotState((state) => {
      const actor = activeUserFromState(request, state);
      const assessment = requireAssessment(state, actor, assessmentId);
      const child = state.children.find((candidate) => candidate.id === assessment.childId);
      if (!child) throw new Error(`Assessment ${assessment.id} references a missing child.`);
      if (!child.processingAllowed) return { blocked: true as const, reason: "Processing permission is not approved for this child." };
      if (!assessment.video) return { blocked: true as const, reason: "Upload a video before starting analysis." };
      const current = assessment.runs.at(-1);
      if (assessment.status === "PROCESSING" && current) return { blocked: false as const, run: current };
      if (!["DRAFT", "FAILED"].includes(assessment.status)) {
        return { blocked: true as const, reason: "This assessment cannot be submitted in its current state." };
      }
      const now = new Date();
      const retry = assessment.status === "FAILED";
      const run = {
        id: `run-${randomUUID()}`,
        attempt: assessment.runs.length + 1,
        status: "QUEUED" as const,
        externalJobId: `sandbox-job-${randomUUID()}`,
        requestedAt: now.toISOString(),
        requestedById: actor.id,
        readyAt: new Date(now.getTime() + 4_000).toISOString(),
        completedAt: null,
        safeErrorCode: null
      };
      assessment.runs.push(run);
      assessment.status = "PROCESSING";
      assessment.updatedAt = now.toISOString();
      assessment.revision = (assessment.revision ?? 0) + 1;
      if (retry) {
        recordSupportEvent(state, {
          type: "PROCESSING_RETRIED",
          actorId: actor.id,
          assessmentId: assessment.id,
          referenceId: run.id,
          occurredAt: now.toISOString()
        });
      }
      return { blocked: false as const, run };
    });
    if (result.blocked) return validationError(result.reason);
    return NextResponse.json({ run: result.run }, { status: 202 });
  } catch (error) {
    return routeError(error);
  }
}
