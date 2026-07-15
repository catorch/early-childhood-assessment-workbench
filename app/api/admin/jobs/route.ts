import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { adminJobsService } from "@/lib/help-review/admin-jobs-service";
import { routeError } from "@/lib/help-review/server-http";

const QuerySchema = z.object({
  filter: z.enum(["all", "failed", "stuck"]),
  search: z.string().trim().max(100)
});

export async function GET(request: NextRequest) {
  try {
    const query = QuerySchema.safeParse({
      filter: request.nextUrl.searchParams.get("filter") ?? "all",
      search: request.nextUrl.searchParams.get("search") ?? ""
    });
    if (!query.success) return NextResponse.json({ error: "The job filters are invalid." }, { status: 400 });
    const projection = await adminJobsService.projection(request, query.data);
    return NextResponse.json(projection);
  } catch (error) {
    return routeError(error);
  }
}
