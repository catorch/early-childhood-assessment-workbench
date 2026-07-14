import { randomUUID } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { deriveReviewSummary } from "@/lib/help-review/domain";
import { assessmentActionLabel, assessmentDestination } from "@/lib/help-review/presentation";
import { AccessError, activeUserFromState, requireChildAssignment } from "@/lib/help-review/server-auth";
import { assertSameOrigin, routeError, validationError } from "@/lib/help-review/server-http";
import { readPilotState, updatePilotState } from "@/lib/help-review/server-store";
import { findExistingAssessmentForCreate } from "@/lib/help-review/server-workflow";

const CreateAssessmentSchema = z.object({
  childId: z.string().min(1),
  observationDate: z.iso.date(),
  requestId: z.uuid()
}).strict();

export async function GET(request: NextRequest) {
  try {
    const state = await readPilotState();
    const actor = activeUserFromState(request, state);
    if (actor.role !== "EDUCATOR") throw new AccessError("The requested resource is unavailable.");
    const filter = request.nextUrl.searchParams.get("filter") ?? "active";
    const search = (request.nextUrl.searchParams.get("search") ?? "").trim().toLowerCase();
    const assessments = state.assessments
      .filter((assessment) => assessment.educatorId === actor.id)
      .filter((assessment) => state.assignments.some((assignment) => assignment.active && assignment.educatorId === actor.id && assignment.childId === assessment.childId))
      .filter((assessment) => filter === "all" || (filter === "finalized" ? assessment.status === "FINALIZED" : assessment.status !== "FINALIZED"))
      .map((assessment) => {
        const child = state.children.find((candidate) => candidate.id === assessment.childId);
        if (!child) return null;
        const summary = assessment.suggestions.length > 0
          ? deriveReviewSummary(assessment.suggestions, assessment.decisions)
          : null;
        return {
          id: assessment.id,
          childId: child.id,
          childExternalId: child.externalChildId,
          childAgeMonths: child.ageMonths,
          observationDate: assessment.observationDate,
          status: assessment.status,
          updatedAt: assessment.updatedAt,
          progress: summary?.progress ?? null,
          actionHref: assessmentDestination(assessment),
          actionLabel: assessmentActionLabel(assessment)
        };
      })
      .filter((assessment): assessment is NonNullable<typeof assessment> => assessment !== null)
      .filter((assessment) => !search || assessment.childExternalId.toLowerCase().includes(search))
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    return NextResponse.json({ assessments });
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const parsed = CreateAssessmentSchema.safeParse(await request.json());
    if (!parsed.success) return validationError("Choose a valid observation date.");
    const assessment = await updatePilotState((state) => {
      const actor = activeUserFromState(request, state);
      if (actor.role !== "EDUCATOR") throw new AccessError("The requested resource is unavailable.");
      requireChildAssignment(state, actor.id, parsed.data.childId);
      const child = state.children.find((candidate) => candidate.id === parsed.data.childId && candidate.isActive);
      if (!child) throw new Error("Assigned child is missing from pilot state.");
      const existingAssessment = findExistingAssessmentForCreate(
        state,
        actor.id,
        child.id,
        parsed.data.observationDate,
        parsed.data.requestId
      );
      if (existingAssessment) return existingAssessment;
      const now = new Date().toISOString();
      const created = {
        id: `assessment-${randomUUID()}`,
        childId: child.id,
        educatorId: actor.id,
        observationDate: parsed.data.observationDate,
        status: "DRAFT" as const,
        video: null,
        runs: [],
        suggestions: [],
        decisions: [],
        finalizedAt: null,
        finalizedById: null,
        createdAt: now,
        updatedAt: now,
        revision: 0,
        clientRequestId: parsed.data.requestId,
        finalizationKey: null
      };
      state.assessments.push(created);
      return created;
    });
    return NextResponse.json({ assessment }, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
