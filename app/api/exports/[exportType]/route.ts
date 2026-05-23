import { NextRequest, NextResponse } from "next/server";

import { exportCsv, exportJson, type ExportType } from "@/lib/exporters";
import { requireRole } from "@/lib/auth";

const exportTypes: ExportType[] = ["ai-outputs", "human-ratings", "review-overrides", "reliability", "prompt-log"];

export async function GET(request: NextRequest, { params }: { params: Promise<{ exportType: string }> }) {
  const role = requireRole(["Admin", "Engineer", "Operator"]);
  if (!role.ok) {
    return NextResponse.json({ error: role.error }, { status: role.status });
  }

  const { exportType } = await params;

  if (!exportTypes.includes(exportType as ExportType)) {
    return NextResponse.json({ error: "Unsupported export type" }, { status: 404 });
  }

  const format = request.nextUrl.searchParams.get("format") ?? "csv";
  const type = exportType as ExportType;

  if (format === "json") {
    return new NextResponse(exportJson(type), {
      headers: {
        "content-type": "application/json",
        "content-disposition": `attachment; filename="${type}.json"`
      }
    });
  }

  return new NextResponse(exportCsv(type), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${type}.csv"`
    }
  });
}
