import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { ROSTER_IMPORT_MAX_BYTES, rosterImportService, RosterImportValidationError } from "@/lib/help-review/roster-import";
import { AccessError, activeUserFromState } from "@/lib/help-review/server-auth";
import { assertSameOrigin, enforceRateLimit, readJsonBody, routeError, validationError } from "@/lib/help-review/server-http";
import { readPilotState } from "@/lib/help-review/server-store";

const RosterImportSchema = z.object({
  csv: z.string().min(1).max(ROSTER_IMPORT_MAX_BYTES),
  apply: z.boolean()
}).strict();

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    await enforceRateLimit(request, "admin-roster-import", { limit: 10 });
    const parsed = RosterImportSchema.safeParse(await readJsonBody(request, ROSTER_IMPORT_MAX_BYTES * 2));
    if (!parsed.success) return validationError("The roster import request is invalid.");

    const state = await readPilotState();
    const actor = activeUserFromState(request, state);
    if (actor.role !== "ADMIN") throw new AccessError("The requested resource is unavailable.");

    const summary = await rosterImportService.run(Buffer.from(parsed.data.csv, "utf8"), {
      actorId: actor.id,
      dryRun: !parsed.data.apply
    });
    return NextResponse.json(summary);
  } catch (error) {
    if (error instanceof RosterImportValidationError) {
      return NextResponse.json({ error: error.message, issues: error.issues }, { status: 400 });
    }
    return routeError(error);
  }
}
