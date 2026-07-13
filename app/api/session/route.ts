import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { activeUserFromState, SESSION_COOKIE } from "@/lib/help-review/server-auth";
import { assertSameOrigin, routeError, validationError } from "@/lib/help-review/server-http";
import { readPilotState } from "@/lib/help-review/server-store";

const SandboxSignInSchema = z.object({
  userId: z.enum(["user-educator-1", "user-educator-2", "user-admin-1"])
}).strict();

export async function GET(request: NextRequest) {
  try {
    const state = await readPilotState();
    return NextResponse.json({ user: activeUserFromState(request, state), sandbox: true });
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const parsed = SandboxSignInSchema.safeParse(await request.json());
    if (!parsed.success) return validationError("Choose an available sandbox profile.");
    const state = await readPilotState();
    const user = state.users.find((candidate) => candidate.id === parsed.data.userId && candidate.isActive);
    if (!user) return NextResponse.json({ error: "Unable to sign in with that profile." }, { status: 401 });
    if (!state.access.some((provision) => provision.userId === user.id && provision.active)) {
      return NextResponse.json({ error: "Unable to sign in with that profile." }, { status: 401 });
    }
    const response = NextResponse.json({ user, sandbox: true });
    response.cookies.set(SESSION_COOKIE, user.id, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 8
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
