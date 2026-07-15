import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { assessmentService } from "@/lib/help-review/assessment-service";
import { assessmentDestination } from "@/lib/help-review/presentation";
import {
  assertSameOrigin,
  enforceRateLimit,
  readJsonBody,
  routeError,
  validationError
} from "@/lib/help-review/server-http";

const CreateAssessmentSchema = z.object({
  childId: z.string().min(1),
  observationDate: z.iso.date(),
  requestId: z.uuid()
}).strict();

export async function GET(request: NextRequest) {
  try {
    const filter = request.nextUrl.searchParams.get("filter") ?? "active";
    const search = (request.nextUrl.searchParams.get("search") ?? "").trim().toLowerCase();
    if (search.length > 100) return validationError("The assessment search is too long.");
    if (!["active", "finalized", "all"].includes(filter)) {
      return NextResponse.json({ error: "The assessment filter is invalid." }, { status: 400 });
    }
    return NextResponse.json(await assessmentService.list(request, {
      filter: filter as "active" | "finalized" | "all",
      search
    }));
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    await enforceRateLimit(request, "assessment-create", { limit: 30 });
    const parsed = CreateAssessmentSchema.safeParse(await readJsonBody(request, 16 * 1024));
    if (!parsed.success) return validationError("Choose a valid observation date.");
    const assessment = await assessmentService.create(request, parsed.data);
    return NextResponse.json({
      assessment: {
        id: assessment.id,
        childId: assessment.childId,
        observationDate: assessment.observationDate,
        contextSnapshot: assessment.contextSnapshot,
        contentCatalogVersion: assessment.contentCatalogVersion,
        scoringContractVersion: assessment.scoringContractVersion,
        status: assessment.status,
        updatedAt: assessment.updatedAt,
        revision: assessment.revision ?? 0,
        actionHref: assessmentDestination(assessment)
      }
    }, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
