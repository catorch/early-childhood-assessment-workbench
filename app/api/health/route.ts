import { NextResponse } from "next/server";

import { assertRuntimeConfiguration } from "@/lib/help-review/runtime-config";
import { assertConfiguredHelpCatalog } from "@/lib/help-review/help-catalog";
import { readPilotState } from "@/lib/help-review/server-store";

export const dynamic = "force-dynamic";
export const maxDuration = 5;

export async function GET() {
  const checkedAt = new Date().toISOString();
  try {
    assertRuntimeConfiguration();
    assertConfiguredHelpCatalog();
    await readPilotState();
    return NextResponse.json({ status: "ready", checkedAt }, {
      headers: { "Cache-Control": "no-store" }
    });
  } catch {
    return NextResponse.json({ status: "unavailable", checkedAt }, {
      status: 503,
      headers: { "Cache-Control": "no-store", "Retry-After": "30" }
    });
  }
}
