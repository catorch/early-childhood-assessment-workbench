import { NextRequest, NextResponse } from "next/server";

import { activeUserFromState, requireChildAssignment } from "@/lib/help-review/server-auth";
import { routeError } from "@/lib/help-review/server-http";
import { readPilotState } from "@/lib/help-review/server-store";

export async function GET(request: NextRequest, context: { params: Promise<{ childId: string }> }) {
  try {
    const { childId } = await context.params;
    const state = await readPilotState();
    const actor = activeUserFromState(request, state);
    if (actor.role !== "EDUCATOR") return NextResponse.json({ error: "Resource unavailable." }, { status: 404 });
    requireChildAssignment(state, actor.id, childId);
    const child = state.children.find((candidate) => candidate.id === childId && candidate.isActive);
    if (!child) return NextResponse.json({ error: "Resource unavailable." }, { status: 404 });
    const assessments = state.assessments
      .filter((assessment) => assessment.childId === child.id && assessment.educatorId === actor.id)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    return NextResponse.json({ child, assessments });
  } catch (error) {
    return routeError(error);
  }
}
