import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  activeUserFromState,
  sandboxIdentity,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS
} from "@/lib/help-review/server-auth";
import { sessionUser } from "@/lib/help-review/public-projections";
import { assertSameOrigin, enforceRateLimit, readJsonBody, routeError, validationError } from "@/lib/help-review/server-http";
import { readPilotState } from "@/lib/help-review/server-store";

const SandboxSignInSchema = z.object({
  userId: z.enum(["user-educator-1", "user-educator-2", "user-admin-1"])
}).strict();

export async function GET(request: NextRequest) {
  try {
    const state = await readPilotState();
    return NextResponse.json({ user: sessionUser(activeUserFromState(request, state)), sandbox: true });
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    enforceRateLimit(request, "sandbox-sign-in", { limit: process.env.NODE_ENV === "production" ? 10 : 200 });
    const parsed = SandboxSignInSchema.safeParse(await readJsonBody(request, 8 * 1024));
    if (!parsed.success) return validationError("Choose an available sandbox profile.");
    const state = await readPilotState();
    const user = state.users.find((candidate) => candidate.id === parsed.data.userId && candidate.isActive);
    if (!user) return NextResponse.json({ error: "Unable to sign in with that profile." }, { status: 401 });
    if (!state.access.some((provision) => provision.userId === user.id && provision.active)) {
      return NextResponse.json({ error: "Unable to sign in with that profile." }, { status: 401 });
    }
    const response = NextResponse.json({ user: sessionUser(user), sandbox: true });
    response.cookies.set(SESSION_COOKIE, sandboxIdentity.issue(user.id), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: SESSION_MAX_AGE_SECONDS
    });
    return response;
  } catch (error) {
    return routeError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const response = NextResponse.json({ signedOut: true });
    response.cookies.set(SESSION_COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
    return response;
  } catch (error) {
    return routeError(error);
  }
}
