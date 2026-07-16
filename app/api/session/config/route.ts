import { NextResponse } from "next/server";

import { selectedIdentityAdapter } from "@/lib/help-review/server-auth";

export function GET() {
  const identity = selectedIdentityAdapter();
  return NextResponse.json({ mode: identity.name }, {
    headers: { "Cache-Control": "no-store" }
  });
}
