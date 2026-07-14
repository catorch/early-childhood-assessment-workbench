import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

import { get } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";

import { activeUserFromState } from "@/lib/help-review/server-auth";
import { recordSupportEvent } from "@/lib/help-review/server-events";
import { routeError } from "@/lib/help-review/server-http";
import { requireAssessment } from "@/lib/help-review/server-workflow";
import { updatePilotState, uploadDirectory } from "@/lib/help-review/server-store";

export async function GET(request: NextRequest, context: { params: Promise<{ assessmentId: string }> }) {
  try {
    const { assessmentId } = await context.params;
    const range = request.headers.get("range");
    const video = await updatePilotState((state) => {
      const actor = activeUserFromState(request, state);
      const assessment = requireAssessment(state, actor, assessmentId);
      if (!assessment.video) return null;
      if (!range || range.startsWith("bytes=0-")) {
        recordSupportEvent(state, {
          type: "VIDEO_ACCESSED",
          actorId: actor.id,
          assessmentId: assessment.id,
          referenceId: assessment.video.id
        });
      }
      return assessment.video;
    });
    if (!video) return NextResponse.json({ error: "Video unavailable." }, { status: 404 });
    if (process.env.HELP_REVIEW_VIDEO_ADAPTER === "vercel-blob") {
      const blob = await get(video.storageKey, {
        access: "private",
        headers: range ? { Range: range } : undefined
      });
      const statusCode: number = blob?.statusCode ?? 404;
      if (!blob?.stream || (statusCode !== 200 && statusCode !== 206)) {
        return NextResponse.json({ error: "Video unavailable." }, { status: 404 });
      }
      const headers = new Headers({
        "Accept-Ranges": blob.headers.get("accept-ranges") ?? "bytes",
        "Cache-Control": "private, no-store",
        "Content-Type": blob.blob.contentType ?? video.contentType,
        "X-Content-Type-Options": "nosniff"
      });
      for (const name of ["content-length", "content-range"]) {
        const value = blob.headers.get(name);
        if (value) headers.set(name, value);
      }
      const responseStatus = range && headers.has("content-range") ? 206 : statusCode;
      return new NextResponse(blob.stream, { status: responseStatus, headers });
    }
    const filePath = path.join(uploadDirectory(), path.basename(video.storageKey));
    const metadata = await stat(filePath);
    let start = 0;
    let end = metadata.size - 1;
    let status = 200;
    if (range) {
      const match = /^bytes=(\d+)-(\d*)$/.exec(range);
      if (!match) return new NextResponse(null, { status: 416, headers: { "Content-Range": `bytes */${metadata.size}` } });
      start = Number(match[1]);
      end = match[2] ? Number(match[2]) : end;
      if (start > end || end >= metadata.size) {
        return new NextResponse(null, { status: 416, headers: { "Content-Range": `bytes */${metadata.size}` } });
      }
      status = 206;
    }
    const stream = Readable.toWeb(createReadStream(filePath, { start, end })) as ReadableStream;
    const headers: Record<string, string> = {
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, no-store",
      "Content-Length": String(end - start + 1),
      "Content-Type": video.contentType
    };
    if (status === 206) headers["Content-Range"] = `bytes ${start}-${end}/${metadata.size}`;
    return new NextResponse(stream, { status, headers });
  } catch (error) {
    return routeError(error);
  }
}
