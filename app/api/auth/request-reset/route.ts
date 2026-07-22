import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { issueAuthToken } from "@/lib/help-review/email-password-auth";
import { sendAuthEmail, setPasswordUrl } from "@/lib/help-review/email-sender";
import { selectedIdentityAdapter } from "@/lib/help-review/server-auth";
import { assertSameOrigin, enforceRateLimit, readJsonBody, routeError } from "@/lib/help-review/server-http";
import { updatePilotState } from "@/lib/help-review/server-store";

const RequestResetSchema = z.object({
  email: z.email().max(254)
}).strict();

/** Always returns the same acknowledged response so account existence is never disclosed. */
export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    await enforceRateLimit(request, "password-reset", {
      limit: process.env.NODE_ENV === "production" ? 5 : 200
    });
    const acknowledged = NextResponse.json({ ok: true });
    if (selectedIdentityAdapter().name !== "email-password") return acknowledged;
    const parsed = RequestResetSchema.safeParse(await readJsonBody(request, 8 * 1024));
    if (!parsed.success) return acknowledged;
    const exactEmail = parsed.data.email.trim().toLowerCase();
    const issued = await updatePilotState((state) => {
      const user = state.users.find((candidate) => candidate.email.toLowerCase() === exactEmail && candidate.isActive);
      if (!user) return null;
      if (!state.access.some((candidate) => candidate.userId === user.id && candidate.active)) return null;
      return issueAuthToken(state, { userId: user.id, purpose: "PASSWORD_RESET", createdById: user.id });
    });
    if (issued) {
      await sendAuthEmail({
        to: exactEmail,
        subject: "HELP AI Crediting Companion password reset",
        bodyText: "A password reset was requested for your HELP AI Crediting Companion account. Use the link below within two hours to set a new password.",
        actionUrl: setPasswordUrl(issued.rawToken)
      }).catch((error) => {
        console.error(JSON.stringify({ event: "help_review_auth_email_failure", errorType: error instanceof Error ? error.name : "UnknownError" }));
      });
    }
    return acknowledged;
  } catch (error) {
    return routeError(error);
  }
}
