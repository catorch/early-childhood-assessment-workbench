import { NextResponse } from "next/server";

import { selectedIdentityAdapter } from "@/lib/help-review/server-auth";

export function GET() {
  const identity = selectedIdentityAdapter();
  if (identity.name === "sandbox") {
    return NextResponse.json({ mode: "sandbox" }, {
      headers: { "Cache-Control": "no-store" }
    });
  }
  return NextResponse.json({
    mode: "identity-platform",
    apiKey: process.env.HELP_REVIEW_IDENTITY_PLATFORM_API_KEY ?? ""
  }, {
    headers: { "Cache-Control": "no-store" }
  });
}
