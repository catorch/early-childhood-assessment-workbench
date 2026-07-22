import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { adminAccessService, type IssuedInvite } from "@/lib/help-review/admin-access-service";
import { sendAuthEmail, selectedEmailAdapter, setPasswordUrl } from "@/lib/help-review/email-sender";
import { assertSameOrigin, enforceRateLimit, readJsonBody, routeError, validationError } from "@/lib/help-review/server-http";

const AccessMutationSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("PROVISION_STAFF"),
    email: z.email().max(254),
    displayName: z.string().trim().min(2).max(100),
    role: z.enum(["EDUCATOR", "ADMIN"])
  }).strict(),
  z.object({ action: z.literal("RESEND_INVITE"), userId: z.string().min(1) }).strict(),
  z.object({
    action: z.literal("EDIT_STAFF"),
    userId: z.string().min(1),
    displayName: z.string().trim().min(2).max(100).optional(),
    role: z.enum(["EDUCATOR", "ADMIN"]).optional()
  }).strict(),
  z.object({ action: z.literal("REMOVE_STAFF"), userId: z.string().min(1) }).strict(),
  z.object({ action: z.literal("SET_ACCESS"), userId: z.string().min(1), active: z.boolean() }).strict(),
  z.object({ action: z.literal("SET_ASSIGNMENT"), userId: z.string().min(1), childId: z.string().min(1), active: z.boolean() }).strict()
]);

/** Sends the invitation after the state change commits; the raw token never enters the JSON response in production. */
async function deliverInvite(invite: IssuedInvite): Promise<{ readonly inviteEmail: "SENT" | "FAILED"; readonly inviteUrl?: string }> {
  const actionUrl = setPasswordUrl(invite.rawToken);
  try {
    await sendAuthEmail({
      to: invite.email,
      subject: "Your HELP AI Crediting Companion account",
      bodyText: "You have been invited to HELP AI Crediting Companion. Use the link below within seven days to set your password and sign in.",
      actionUrl
    });
    const developmentConsole = process.env.NODE_ENV !== "production" && selectedEmailAdapter() === "console";
    return developmentConsole ? { inviteEmail: "SENT", inviteUrl: actionUrl } : { inviteEmail: "SENT" };
  } catch (error) {
    console.error(JSON.stringify({
      event: "help_review_auth_email_failure",
      errorType: error instanceof Error ? error.name : "UnknownError"
    }));
    return { inviteEmail: "FAILED" };
  }
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
    const result = await adminAccessService.mutate(request, parsed.data);
    if ("blocked" in result && result.blocked) {
      return NextResponse.json({ error: result.reason }, { status: 409 });
    }
    if ("invite" in result && result.invite) {
      const { invite, ...safeResult } = result;
      const delivery = await deliverInvite(invite);
      return NextResponse.json({ ...safeResult, ...delivery });
    }
    return NextResponse.json(result);
  } catch (error) {
    return routeError(error);
  }
}
