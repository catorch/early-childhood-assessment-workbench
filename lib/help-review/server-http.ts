/** Small response helpers that keep authorization errors non-disclosing. */

import { createHash, randomUUID } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import { AccessError } from "./server-auth";

export class RequestError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 409 | 413 | 429
  ) {
    super(message);
  }
}

const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>();

export function routeError(error: unknown): NextResponse {
  if (error instanceof AccessError) {
    return NextResponse.json({ error: error.status === 401 ? "Sign in is required." : "Resource unavailable." }, { status: error.status });
  }
  if (error instanceof RequestError) {
    return NextResponse.json({ error: error.message }, {
      status: error.status,
      headers: error.status === 429 ? { "Retry-After": "60" } : undefined
    });
  }
  const correlationId = randomUUID();
  console.error(JSON.stringify({
    event: "help_review_route_failure",
    correlationId,
    errorType: error instanceof Error ? error.name : "UnknownError"
  }));
  return NextResponse.json(
    { error: "The request could not be completed.", reference: correlationId },
    { status: 500, headers: { "X-Correlation-Id": correlationId } }
  );
}

export function validationError(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 400 });
}

/** Rejects browser mutations sent by a different origin. */
export function assertSameOrigin(request: NextRequest): void {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && !["same-origin", "same-site", "none"].includes(fetchSite)) {
    throw new AccessError("The request origin is not allowed.", 403);
  }
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

/** Returns the browser-facing origin after assertSameOrigin has accepted the request. */
export function publicRequestOrigin(request: NextRequest): string {
  const origin = request.headers.get("origin");
  if (origin) return new URL(origin).origin;

  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",", 1)[0]?.trim();
  const forwardedProtocol = request.headers.get("x-forwarded-proto")?.split(",", 1)[0]?.trim();
  if (forwardedHost && (forwardedProtocol === "http" || forwardedProtocol === "https")) {
    return `${forwardedProtocol}://${forwardedHost}`;
  }
  return request.nextUrl.origin;
}

export function assertRequestBodyLimit(request: NextRequest, maximumBytes: number): void {
  const value = request.headers.get("content-length");
  if (!value) return;
  const contentLength = Number(value);
  if (!Number.isSafeInteger(contentLength) || contentLength < 0 || contentLength > maximumBytes) {
    throw new RequestError("The request body is too large.", 413);
  }
}

export async function readJsonBody(request: NextRequest, maximumBytes = 32 * 1024): Promise<unknown> {
  assertRequestBodyLimit(request, maximumBytes);
  const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (contentType !== "application/json") throw new RequestError("A JSON request body is required.", 400);
  const body = await request.text();
  if (Buffer.byteLength(body, "utf8") > maximumBytes) throw new RequestError("The request body is too large.", 413);
  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw new RequestError("The JSON request body is invalid.", 400);
  }
}

export function enforceRateLimit(
  request: NextRequest,
  scope: string,
  options: { readonly limit: number; readonly windowMs?: number },
  now = Date.now()
): void {
  const windowMs = options.windowMs ?? 60_000;
  for (const [key, bucket] of rateLimitBuckets) {
    if (bucket.resetAt <= now) rateLimitBuckets.delete(key);
  }
  const identity = [
    request.headers.get("x-forwarded-for")?.split(",", 1)[0]?.trim() ?? "unknown",
    request.cookies.get("help_review_session")?.value ?? "anonymous"
  ].join(":");
  const key = `${scope}:${createHash("sha256").update(identity).digest("hex")}`;
  const current = rateLimitBuckets.get(key);
  if (!current || current.resetAt <= now) {
    rateLimitBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  current.count += 1;
  if (current.count > options.limit) throw new RequestError("Too many requests. Wait before trying again.", 429);
}
