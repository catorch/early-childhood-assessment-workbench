import { randomUUID } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import { AccessError, activeUserFromState } from "@/lib/help-review/server-auth";
import { recordSupportEvent } from "@/lib/help-review/server-events";
import { assertSameOrigin, routeError } from "@/lib/help-review/server-http";
import { updatePilotState } from "@/lib/help-review/server-store";

export async function POST(request: NextRequest, context: { params: Promise<{ runId: string }> }) {
  try {
    assertSameOrigin(request);
    const { runId } = await context.params;
    const result = await updatePilotState((state) => {
      const actor = activeUserFromState(request, state);
      if (actor.role !== "ADMIN") throw new AccessError("The requested resource is unavailable.");
      const assessment = state.assessments.find((candidate) => candidate.runs.some((run) => run.id === runId));
      const failedRun = assessment?.runs.find((run) => run.id === runId);
      const child = assessment ? state.children.find((candidate) => candidate.id === assessment.childId) : null;
      const stuck = failedRun &&
        (failedRun.status === "QUEUED" || failedRun.status === "RUNNING") &&
        new Date(failedRun.requestedAt).getTime() <= Date.now() - 15 * 60 * 1_000;
      if (!assessment || !failedRun || (failedRun.status !== "FAILED" && !stuck) || assessment.runs.at(-1)?.id !== failedRun.id) {
        return { blocked: true as const, reason: "This processing run is no longer eligible for retry." };
      }
      if (!assessment.video || child?.processingAllowed !== true) {
        return { blocked: true as const, reason: "The source video or processing permission is unavailable." };
      }
      const now = new Date();
      if (stuck) {
        failedRun.status = "FAILED";
        failedRun.completedAt = now.toISOString();
        failedRun.safeErrorCode = "PROCESSING_STUCK";
      }
      const active = assessment.runs.find((run) => run.status === "QUEUED" || run.status === "RUNNING");
      if (active) return { blocked: false as const, run: active };
      const run = {
        id: `run-${randomUUID()}`,
        attempt: Math.max(...assessment.runs.map((candidate) => candidate.attempt), 0) + 1,
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
      recordSupportEvent(state, {
        type: "PROCESSING_RETRIED",
        actorId: actor.id,
        assessmentId: assessment.id,
        referenceId: run.id,
        occurredAt: now.toISOString()
      });
      return { blocked: false as const, run };
    });
    if (result.blocked) return NextResponse.json({ error: result.reason }, { status: 409 });
    return NextResponse.json({ run: result.run }, { status: 202 });
  } catch (error) {
    return routeError(error);
  }
}
