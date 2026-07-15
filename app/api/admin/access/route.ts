import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { adminAccessService } from "@/lib/help-review/admin-access-service";
import { ensureIdentityPlatformAccount, setIdentityPlatformAccountEnabled } from "@/lib/help-review/identity-platform";
import { AccessError, selectedIdentityAdapter } from "@/lib/help-review/server-auth";
import { assertSameOrigin, enforceRateLimit, readJsonBody, RequestError, routeError, validationError } from "@/lib/help-review/server-http";

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

async function prepareIdentityPlatformMutation(
  request: NextRequest,
  mutation: z.infer<typeof AccessMutationSchema>
): Promise<void> {
  if (selectedIdentityAdapter().name !== "identity-platform" || mutation.action === "SET_ASSIGNMENT") return;
  const projection = await adminAccessService.projection(request);
  if (mutation.action === "PROVISION_STAFF") {
    const exactEmail = mutation.email.trim().toLowerCase();
    const existing = projection.staff.find((user) => user.email.toLowerCase() === exactEmail);
    if (existing && existing.role !== mutation.role) {
      throw new RequestError("That identity is already provisioned with a different role.", 409);
    }
    await ensureIdentityPlatformAccount(exactEmail, mutation.displayName);
    return;
  }

  const staffMember = projection.staff.find((user) => user.id === mutation.userId);
  if (!staffMember) throw new AccessError("The requested resource is unavailable.");
  if (!mutation.active && staffMember.id === projection.actorId) {
    throw new AccessError("An Admin cannot deactivate their own active session.", 403);
  }
  await setIdentityPlatformAccountEnabled(staffMember, mutation.active);
}

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
    await enforceRateLimit(request, "admin-access-mutation", { limit: 60 });
    const parsed = AccessMutationSchema.safeParse(await readJsonBody(request, 16 * 1024));
    if (!parsed.success) return validationError("The access change is invalid.");
    await prepareIdentityPlatformMutation(request, parsed.data);
    const result = await adminAccessService.mutate(request, parsed.data);
    if ("blocked" in result && result.blocked) {
      return NextResponse.json({ error: result.reason }, { status: 409 });
    }
    return NextResponse.json(result);
  } catch (error) {
    return routeError(error);
  }
}
