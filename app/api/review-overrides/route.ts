import { NextRequest, NextResponse } from "next/server";

import { detections } from "@/lib/data";
import { requireRole } from "@/lib/auth";
import { ReviewOverrideInputSchema } from "@/lib/validators/schemas";

export async function POST(request: NextRequest) {
  const role = requireRole(["Reviewer", "Admin"]);
  if (!role.ok) {
    return NextResponse.json({ error: role.error }, { status: role.status });
  }

  const payload = await request.json().catch(() => null);
  const parsed = ReviewOverrideInputSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid review override payload", details: parsed.error.issues }, { status: 400 });
  }

  const detection = detections.find((item) => item.id === parsed.data.aiDetectionId);
  if (!detection) {
    return NextResponse.json({ error: "AI detection not found" }, { status: 404 });
  }

  return NextResponse.json(
    {
      data: {
        id: `override_${Date.now()}`,
        aiDetectionId: detection.id,
        originalCredit: detection.credit,
        correctedCredit: parsed.data.correctedCredit,
        reviewerNote: parsed.data.reviewerNote,
        reviewerId: role.user.id,
        createdAt: new Date().toISOString()
      }
    },
    { status: 201 }
  );
}
