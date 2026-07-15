import { NextRequest, NextResponse } from "next/server";

import { childService } from "@/lib/help-review/child-service";
import { routeError } from "@/lib/help-review/server-http";

export async function GET(request: NextRequest) {
  try {
    return NextResponse.json(await childService.listAssigned(request));
  } catch (error) {
    return routeError(error);
  }
}
