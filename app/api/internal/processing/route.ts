import { timingSafeEqual } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import { processQueuedRuns } from "@/lib/help-review/processing-coordinator";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

function authorized(request: NextRequest): boolean {
  const expected = process.env.HELP_REVIEW_WORKER_SECRET ?? process.env.CRON_SECRET;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "")
    ?? request.headers.get("x-help-review-worker-secret")
    ?? "";
  if (!expected || !supplied) return process.env.NODE_ENV !== "production";
  const left = Buffer.from(expected);
  const right = Buffer.from(supplied);
  return left.length === right.length && timingSafeEqual(left, right);
}

async function run(request: NextRequest): Promise<NextResponse> {
  if (!authorized(request)) return NextResponse.json({ error: "Resource unavailable." }, { status: 404 });
  const result = await processQueuedRuns(2);
  return NextResponse.json({ ok: true, ...result });
}

export const GET = run;
export const POST = run;
