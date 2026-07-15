import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  createScreenFixtureState,
  ensureScreenFixtureVideos,
  applyScreenStressScenario,
  SCREEN_STRESS_SCENARIOS,
  SCREEN_IDS
} from "@/lib/help-review/screen-state-fixtures";
import { readJsonBody, routeError } from "@/lib/help-review/server-http";
import { updatePilotState } from "@/lib/help-review/server-store";

const FixtureRequestSchema = z.object({
  screenId: z.string().refine((value) => SCREEN_IDS.includes(value)),
  stress: z.enum(SCREEN_STRESS_SCENARIOS).optional()
}).strict();

export async function POST(request: NextRequest) {
  try {
    if (
      process.env.NODE_ENV === "production" ||
      request.headers.get("x-help-review-fixture-key") !== "playwright"
    ) {
      return NextResponse.json({ error: "Resource unavailable." }, { status: 404 });
    }
    const parsed = FixtureRequestSchema.safeParse(await readJsonBody(request, 8 * 1024));
    if (!parsed.success) return NextResponse.json({ error: "Unknown screen fixture." }, { status: 400 });
    const fixture = createScreenFixtureState(parsed.data.screenId, await ensureScreenFixtureVideos());
    if (parsed.data.stress) applyScreenStressScenario(fixture, parsed.data.stress);
    await updatePilotState((state) => {
      state.users = fixture.users;
      state.children = fixture.children;
      state.assignments = fixture.assignments;
      state.assessments = fixture.assessments;
      state.access = fixture.access;
      state.supportEvents = [];
      state.videoAccessGrants = [];
    });
    return NextResponse.json({ screenId: parsed.data.screenId, stress: parsed.data.stress ?? null, ready: true });
  } catch (error) {
    return routeError(error);
  }
}
