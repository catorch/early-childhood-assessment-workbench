import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

import { get } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";

import { reviewService } from "@/lib/help-review/review-service";
import { signedGcsPlaybackUrl } from "@/lib/help-review/gcs-storage";
import { routeError } from "@/lib/help-review/server-http";
import { uploadDirectory } from "@/lib/help-review/server-store";
import { parseVideoByteRange } from "@/lib/help-review/video-policy";

export async function GET(request: NextRequest, context: { params: Promise<{ assessmentId: string }> }) {
  try {
    const { assessmentId } = await context.params;
    const range = request.headers.get("range");
    const token = request.nextUrl.searchParams.get("token");
    const video = await reviewService.authorizePlayback(request, assessmentId, token, range);
    if (!video) return NextResponse.json({ error: "Video unavailable." }, { status: 404 });
    const parsedRange = parseVideoByteRange(range, video.byteSize);
    if (!parsedRange) {
      return new NextResponse(null, { status: 416, headers: { "Content-Range": `bytes */${video.byteSize}` } });
    }
    const storageProvider = video.storageProvider ?? process.env.HELP_REVIEW_VIDEO_ADAPTER ?? "local";
    if (storageProvider === "gcs") {
      const location = await signedGcsPlaybackUrl(video);
      return NextResponse.redirect(location, {
        status: 307,
        headers: {
          "Cache-Control": "private, no-store",
          "Referrer-Policy": "no-referrer"
        }
      });
    }
    if (storageProvider === "vercel-blob") {
      const blob = await get(video.storageKey, {
        access: "private",
        headers: parsedRange.partial ? { Range: `bytes=${parsedRange.start}-${parsedRange.end}` } : undefined
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
      const responseStatus = parsedRange.partial && headers.has("content-range") ? 206 : statusCode;
      return new NextResponse(blob.stream, { status: responseStatus, headers });
    }
    const filePath = path.join(uploadDirectory(), path.basename(video.storageKey));
    const metadata = await stat(filePath);
    if (metadata.size !== video.byteSize) {
      return NextResponse.json({ error: "Video unavailable." }, { status: 404 });
    }
    const { start, end, partial } = parsedRange;
    const status = partial ? 206 : 200;
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
