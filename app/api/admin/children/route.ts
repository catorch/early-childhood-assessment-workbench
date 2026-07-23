import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { adminChildrenService } from "@/lib/help-review/admin-children-service";
import { assertSameOrigin, enforceRateLimit, readJsonBody, routeError, validationError } from "@/lib/help-review/server-http";

const SafeIdentifierSchema = z.string().trim().min(1).max(100).refine(
  (value) => !/[\u0000-\u001f\u007f]/.test(value),
  "Control characters are not allowed."
);
const ContextLabelSchema = z.string().trim().max(160).refine(
  (value) => !/[\u0000-\u001f\u007f]/.test(value),
  "Control characters are not allowed."
).transform((value) => value || null);
const AgeMonthsSchema = z.number().int().min(0).max(72);
const SupportContextSchema = z.enum(["NONE_REPORTED", "IFSP", "DISABILITY", "IFSP_AND_DISABILITY", "UNKNOWN"]);

const ChildrenMutationSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("CREATE_CHILD"),
    externalChildId: SafeIdentifierSchema,
    ageMonths: AgeMonthsSchema,
    supportContext: SupportContextSchema,
    contextLabel: ContextLabelSchema,
    processingAllowed: z.boolean()
  }).strict(),
  z.object({
    action: z.literal("EDIT_CHILD"),
    childId: z.string().min(1),
    externalChildId: SafeIdentifierSchema.optional(),
    ageMonths: AgeMonthsSchema.optional(),
    supportContext: SupportContextSchema.optional(),
    contextLabel: ContextLabelSchema.optional(),
    processingAllowed: z.boolean().optional()
  }).strict(),
  z.object({ action: z.literal("SET_CHILD_ACTIVE"), childId: z.string().min(1), active: z.boolean() }).strict()
]);

export async function GET(request: NextRequest) {
  try {
    assertSameOrigin(request);
    return NextResponse.json(await adminChildrenService.projection(request));
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    await enforceRateLimit(request, "admin-children-mutation", { limit: 60 });
    const parsed = ChildrenMutationSchema.safeParse(await readJsonBody(request, 16 * 1024));
    if (!parsed.success) return validationError("The child record change is invalid.");
    const result = await adminChildrenService.mutate(request, parsed.data);
    if ("blocked" in result && result.blocked) {
      return NextResponse.json({ error: result.reason }, { status: 409 });
    }
    return NextResponse.json(result);
  } catch (error) {
    return routeError(error);
  }
}
