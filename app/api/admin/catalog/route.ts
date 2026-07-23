import { NextRequest, NextResponse } from "next/server";

import { configuredHelpCatalog } from "@/lib/help-review/help-catalog";
import { AccessError, activeUserFromState } from "@/lib/help-review/server-auth";
import { assertSameOrigin, routeError } from "@/lib/help-review/server-http";
import { readPilotState } from "@/lib/help-review/server-store";

/** Read-only admin projection of the immutable catalogue artifact configured for this deployment. */
export async function GET(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const state = await readPilotState();
    const actor = activeUserFromState(request, state);
    if (actor.role !== "ADMIN") throw new AccessError("The requested resource is unavailable.");

    const catalog = configuredHelpCatalog();
    return NextResponse.json({
      catalogVersion: catalog.catalogVersion,
      status: catalog.status,
      sourceReference: catalog.sourceReference,
      attribution: catalog.attribution ?? null,
      disclaimer: catalog.disclaimer ?? null,
      creditDefinitions: catalog.creditDefinitions,
      selectionPolicy: catalog.selectionPolicy,
      skills: catalog.skills.map((skill) => ({
        sourceSkillId: skill.sourceSkillId,
        skillCode: skill.skillCode,
        skillName: skill.skillName,
        domain: skill.domain,
        strand: skill.strand,
        rawAgeRange: skill.rawAgeRange ?? null,
        minimumAgeMonths: skill.minimumAgeMonths,
        maximumAgeMonths: skill.maximumAgeMonths,
        alwaysAssess: skill.alwaysAssess ?? false,
        videoScoreability: skill.videoScoreability ?? null,
        sourceOrder: skill.sourceOrder
      }))
    });
  } catch (error) {
    return routeError(error);
  }
}
