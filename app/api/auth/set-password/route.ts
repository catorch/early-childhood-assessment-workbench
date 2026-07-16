import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  applyPassword,
  hashPassword,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  resolveAuthToken
} from "@/lib/help-review/email-password-auth";
import { sessionUser } from "@/lib/help-review/public-projections";
import { recordSupportEvent } from "@/lib/help-review/server-events";
import { selectedIdentityAdapter, SESSION_COOKIE } from "@/lib/help-review/server-auth";
import { assertSameOrigin, enforceRateLimit, readJsonBody, routeError, validationError } from "@/lib/help-review/server-http";
import { updatePilotState } from "@/lib/help-review/server-store";

const SetPasswordSchema = z.object({
  token: z.string().min(20).max(200),
  password: z.string().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH)
}).strict();

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const identity = selectedIdentityAdapter();
    if (identity.name !== "email-password") {
      return NextResponse.json({ error: "Account setup is unavailable." }, { status: 404 });
    }
    await enforceRateLimit(request, "set-password", {
      limit: process.env.NODE_ENV === "production" ? 20 : 200
    });
    const parsed = SetPasswordSchema.safeParse(await readJsonBody(request, 20 * 1024));
    if (!parsed.success) {
      return validationError(`Choose a password between ${PASSWORD_MIN_LENGTH} and ${PASSWORD_MAX_LENGTH} characters.`);
    }
    const passwordHash = await hashPassword(parsed.data.password);
    const user = await updatePilotState((state) => {
      const resolved = resolveAuthToken(state, parsed.data.token);
      if (!resolved) return null;
      applyPassword(state, resolved.user.id, passwordHash);
      recordSupportEvent(state, {
        type: "CREDENTIAL_CHANGED",
        actorId: resolved.user.id,
        subjectId: resolved.user.id,
        referenceId: resolved.token.id
      });
      return resolved.user;
    });
    if (!user) {
      return NextResponse.json(
        { error: "This link is no longer valid. Ask the pilot administrator for a new invitation or request a new reset email." },
        { status: 401 }
      );
    }
    const response = NextResponse.json({ user: sessionUser(user), sandbox: false });
    response.cookies.set(SESSION_COOKIE, identity.issue(user.id), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: identity.sessionMaxAgeSeconds
    });
    return response;
  } catch (error) {
    return routeError(error);
  }
}
