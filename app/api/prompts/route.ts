import { NextRequest, NextResponse } from "next/server";

import { promptVersions } from "@/lib/data";
import { currentUser } from "@/lib/auth";
import { PromptVersionInputSchema } from "@/lib/validators/schemas";

export async function GET() {
  return NextResponse.json({ data: promptVersions });
}

export async function POST(request: NextRequest) {
  const payload = await request.json().catch(() => null);
  const parsed = PromptVersionInputSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid prompt version payload",
        details: parsed.error.issues
      },
      { status: 400 }
    );
  }

  const duplicate = promptVersions.some(
    (prompt) => prompt.name === parsed.data.name && prompt.version === parsed.data.version
  );

  if (duplicate) {
    return NextResponse.json({ error: "Prompt name/version already exists" }, { status: 409 });
  }

  return NextResponse.json(
    {
      data: {
        id: `prompt_${Date.now()}`,
        ...parsed.data,
        status: "CANDIDATE",
        createdBy: currentUser.id,
        createdAt: new Date().toISOString()
      }
    },
    { status: 201 }
  );
}
