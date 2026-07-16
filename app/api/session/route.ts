import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  activeUserFromState,
  selectedIdentityAdapter,
  SESSION_COOKIE,
} from "@/lib/help-review/server-auth";
import { authenticateEmailPassword } from "@/lib/help-review/email-password-auth";
import { sessionUser } from "@/lib/help-review/public-projections";
import { assertSameOrigin, enforceRateLimit, readJsonBody, routeError, validationError } from "@/lib/help-review/server-http";
import { readPilotState } from "@/lib/help-review/server-store";

const SandboxSignInSchema = z.object({
  userId: z.enum(["user-educator-1", "user-educator-2", "user-admin-1"])
}).strict();
const EmailPasswordSignInSchema = z.object({
  email: z.email().max(254),
  password: z.string().min(1).max(4096)
}).strict();

function sessionResponse(user: Parameters<typeof sessionUser>[0]) {
  const identity = selectedIdentityAdapter();
  const response = NextResponse.json({ user: sessionUser(user), sandbox: identity.name === "sandbox" });
  response.cookies.set(SESSION_COOKIE, identity.issue(user.id), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: identity.sessionMaxAgeSeconds
  });
  return response;
}

export async function GET(request: NextRequest) {
  try {
    const state = await readPilotState();
    const identity = selectedIdentityAdapter();
    return NextResponse.json({
      user: sessionUser(activeUserFromState(request, state, identity)),
      sandbox: identity.name === "sandbox"
    });
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const identity = selectedIdentityAdapter();
    await enforceRateLimit(request, `${identity.name}-sign-in`, {
      limit: process.env.NODE_ENV === "production" ? 10 : 200
    });
    const body = await readJsonBody(request, 20 * 1024);
    if (identity.name === "email-password") {
      const parsed = EmailPasswordSignInSchema.safeParse(body);
      if (!parsed.success) return validationError("We could not confirm access.");
      try {
        const state = await readPilotState();
        const user = await authenticateEmailPassword(state, parsed.data.email, parsed.data.password);
        if (!user) return NextResponse.json({ error: "We could not confirm access." }, { status: 401 });
        return sessionResponse(user);
      } catch {
        return NextResponse.json({ error: "We could not confirm access." }, { status: 401 });
      }
    }
    const parsed = SandboxSignInSchema.safeParse(body);
    if (!parsed.success) return validationError("Choose an available sandbox profile.");
    const state = await readPilotState();
    const user = state.users.find((candidate) => candidate.id === parsed.data.userId && candidate.isActive);
    if (!user || !state.access.some((provision) => provision.userId === user.id && provision.active)) {
      return NextResponse.json({ error: "Unable to sign in with that profile." }, { status: 401 });
    }
    return sessionResponse(user);
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
