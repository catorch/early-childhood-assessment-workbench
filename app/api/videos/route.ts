import { NextRequest, NextResponse } from "next/server";

import { children, videos } from "@/lib/data";
import { getVideoStorageAdapter } from "@/lib/storage";
import { RegisterVideoInputSchema } from "@/lib/validators/schemas";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const status = searchParams.get("status");
  const childMatch = searchParams.get("childMatch");
  const reviewState = searchParams.get("reviewState");

  const filtered = videos.filter((video) => {
    if (status && status !== "all" && video.status !== status) return false;
    if (childMatch === "matched" && !video.childId) return false;
    if (childMatch === "unmatched" && video.childId) return false;
    if (reviewState === "needs-review" && video.status !== "NEEDS_REVIEW") return false;
    return true;
  });

  return NextResponse.json({
    data: filtered.map((video) => ({
      id: video.id,
      filename: video.filename,
      fileUrl: video.fileUrl,
      status: video.status,
      datasetSplit: video.datasetSplit,
      childId: video.childId,
      externalChildId: video.externalChildId,
      ageBand: video.ageBand,
      domainFocus: video.domainFocus,
      observedOn: video.observedOn,
      durationSeconds: video.durationSeconds,
      aiRunCount: video.aiRunCount,
      detectionCount: video.detectionCount,
      reviewPriority: video.reviewPriority,
      priorityReason: video.priorityReason
    }))
  });
}

export async function POST(request: NextRequest) {
  const payload = await request.json().catch(() => null);
  const parsed = RegisterVideoInputSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid video registration payload",
        details: parsed.error.issues
      },
      { status: 400 }
    );
  }

  const matchedChild = parsed.data.externalChildId
    ? children.find((child) => child.externalChildId === parsed.data.externalChildId)
    : undefined;
  const stored = await getVideoStorageAdapter().register({
    filename: parsed.data.filename,
    fileUrl: parsed.data.fileUrl,
    contentType: "video/mp4",
    bytes: 0
  });

  return NextResponse.json(
    {
      videoId: `video_registered_${Date.now()}`,
      filename: stored.filename,
      fileUrl: stored.fileUrl,
      status: matchedChild ? "UPLOADED" : "UNMATCHED",
      childId: matchedChild?.id,
      validationErrors: matchedChild || !parsed.data.externalChildId ? [] : ["externalChildId did not match an existing child record"]
    },
    { status: 201 }
  );
}
