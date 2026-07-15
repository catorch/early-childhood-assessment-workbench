import { NextRequest, NextResponse } from "next/server";

import { childService } from "@/lib/help-review/child-service";
import { routeError } from "@/lib/help-review/server-http";

export async function GET(request: NextRequest, context: { params: Promise<{ childId: string }> }) {
  try {
    const { childId } = await context.params;
    return NextResponse.json(await childService.detail(request, childId));
  } catch (error) {
    return routeError(error);
  }
}
