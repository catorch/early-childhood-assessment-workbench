import { NextRequest, NextResponse } from "next/server";

import { rubricSkills, videos } from "@/lib/data";
import { requireRole } from "@/lib/auth";
import { HumanRatingRowSchema, validateRows } from "@/lib/validators/schemas";

export async function POST(request: NextRequest) {
  const role = requireRole(["Admin", "Operator", "Reviewer"]);
  if (!role.ok) {
    return NextResponse.json({ error: role.error }, { status: role.status });
  }

  const payload = await request.json().catch(() => null);
  const rows = Array.isArray(payload?.rows) ? payload.rows : [];
  const result = validateRows(rows, HumanRatingRowSchema);
  const referenceErrors = result.valid.flatMap((row, index) => {
    const errors: string[] = [];
    if (!videos.some((video) => video.id === row.videoId)) errors.push("videoId does not exist");
    if (!rubricSkills.some((skill) => skill.id === row.skillId)) errors.push("skillId does not exist");
    return errors.length ? [{ row: index + 1, errors }] : [];
  });

  return NextResponse.json({
    imported: result.valid.length - referenceErrors.length,
    errors: [...result.errors, ...referenceErrors],
    importedBy: role.user.id
  });
}
