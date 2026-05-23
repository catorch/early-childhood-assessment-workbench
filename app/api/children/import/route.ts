import { NextRequest, NextResponse } from "next/server";

import { children } from "@/lib/data";
import { requireRole } from "@/lib/auth";
import { ChildMetadataRowSchema, validateRows } from "@/lib/validators/schemas";

export async function POST(request: NextRequest) {
  const role = requireRole(["Admin", "Operator"]);
  if (!role.ok) {
    return NextResponse.json({ error: role.error }, { status: role.status });
  }

  const payload = await request.json().catch(() => null);
  const rows = Array.isArray(payload?.rows) ? payload.rows : [];
  const result = validateRows(rows, ChildMetadataRowSchema);

  return NextResponse.json({
    imported: result.valid.length,
    updated: result.valid.filter((row) => children.some((child) => child.externalChildId === row.externalChildId)).length,
    errors: result.errors,
    importedBy: role.user.id
  });
}
