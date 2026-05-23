import { NextRequest, NextResponse } from "next/server";

import { promptVersions } from "@/lib/data";
import { requireRole } from "@/lib/auth";

export async function GET(_request: Request, { params }: { params: Promise<{ promptVersionId: string }> }) {
  const { promptVersionId } = await params;
  const prompt = promptVersions.find((item) => item.id === promptVersionId);

  if (!prompt) {
    return NextResponse.json({ error: "Prompt version not found" }, { status: 404 });
  }

  return NextResponse.json({ data: prompt });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ promptVersionId: string }> }) {
  const role = requireRole(["Admin"]);
  if (!role.ok) {
    return NextResponse.json({ error: role.error }, { status: role.status });
  }

  const { promptVersionId } = await params;
  const payload = await request.json().catch(() => ({}));
  const prompt = promptVersions.find((item) => item.id === promptVersionId);

  if (!prompt) {
    return NextResponse.json({ error: "Prompt version not found" }, { status: 404 });
  }

  if (payload.action !== "promote") {
    return NextResponse.json({ error: "Only promote action is supported in the prototype" }, { status: 400 });
  }

  if (!prompt.modelConfig.structuredOutput) {
    return NextResponse.json({ error: "Prompt lacks required structured output settings" }, { status: 422 });
  }

  return NextResponse.json({
    data: {
      promptVersionId,
      promotedBy: role.user.id,
      promotedAt: new Date().toISOString(),
      priorCurrentVersionId: promptVersions.find((item) => item.status === "CURRENT")?.id
    }
  });
}
