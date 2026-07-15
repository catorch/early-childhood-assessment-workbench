import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { adminAccessService } from "@/lib/help-review/admin-access-service";
import { assertSameOrigin, enforceRateLimit, readJsonBody, routeError, validationError } from "@/lib/help-review/server-http";

const AccessMutationSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("PROVISION_STAFF"),
    email: z.email().max(254),
    displayName: z.string().trim().min(2).max(100),
    role: z.enum(["EDUCATOR", "ADMIN"])
  }).strict(),
  z.object({ action: z.literal("SET_ACCESS"), userId: z.string().min(1), active: z.boolean() }).strict(),
  z.object({ action: z.literal("SET_ASSIGNMENT"), userId: z.string().min(1), childId: z.string().min(1), active: z.boolean() }).strict()
]);

export async function GET(request: NextRequest) {
  try {
    assertSameOrigin(request);
    return NextResponse.json(await adminAccessService.projection(request));
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    enforceRateLimit(request, "admin-access-mutation", { limit: 60 });
    const parsed = AccessMutationSchema.safeParse(await readJsonBody(request, 16 * 1024));
    if (!parsed.success) return validationError("The access change is invalid.");
    const result = await adminAccessService.mutate(request, parsed.data);
    if ("blocked" in result && result.blocked) {
      return NextResponse.json({ error: result.reason }, { status: 409 });
    }
    return NextResponse.json(result);
  } catch (error) {
    return routeError(error);
  }
}
