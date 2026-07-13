/** Small response helpers that keep authorization errors non-disclosing. */

import { NextRequest, NextResponse } from "next/server";

import { AccessError } from "./server-auth";

export function routeError(error: unknown): NextResponse {
  if (error instanceof AccessError) {
    return NextResponse.json({ error: error.status === 401 ? "Sign in is required." : "Resource unavailable." }, { status: error.status });
  }
  console.error("HELP Review route failed", error instanceof Error ? error.message : "Unknown error");
  return NextResponse.json({ error: "The request could not be completed." }, { status: 500 });
}

export function validationError(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 400 });
}

/** Rejects browser mutations sent by a different origin. */
export function assertSameOrigin(request: NextRequest): void {
  const origin = request.headers.get("origin");
  if (!origin) return;
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new AccessError("The request origin is invalid.", 403);
  }
  const requestHost = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? request.nextUrl.host;
  if (originHost !== requestHost) throw new AccessError("The request origin is not allowed.", 403);
}
