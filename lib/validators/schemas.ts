import { z } from "zod";

export const CreditAssignmentSchema = z.enum([
  "CREDIT",
  "PARTIAL_CREDIT",
  "NO_CREDIT",
  "NOT_OBSERVED",
  "UNCERTAIN"
]);

export const RegisterVideoInputSchema = z.object({
  filename: z.string().min(1),
  fileUrl: z.url(),
  externalChildId: z.string().min(1).optional(),
  observationDate: z.iso.datetime().or(z.iso.date()).optional(),
  durationSeconds: z.number().int().positive().max(60 * 60).optional()
});

export const ChildMetadataRowSchema = z.object({
  externalChildId: z.string().min(1),
  ageMonths: z.coerce.number().int().min(0).max(96),
  ageBand: z.string().min(1),
  classroom: z.string().optional()
});

export const HumanRatingRowSchema = z.object({
  videoId: z.string().min(1),
  skillId: z.string().min(1),
  raterId: z.string().min(1),
  credit: CreditAssignmentSchema,
  notes: z.string().optional()
});

export const PromptVersionInputSchema = z.object({
  name: z.string().min(1),
  version: z.string().min(1),
  promptText: z.string().min(100),
  modelName: z.string().min(1),
  modelConfig: z.object({
    temperature: z.number().min(0).max(2),
    maxTokens: z.number().int().min(256).max(65536),
    topP: z.number().min(0).max(1),
    structuredOutput: z.boolean(),
    schemaVersion: z.string().min(1)
  }),
  changeNotes: z.array(z.string().min(1)).min(1)
});

export const EvidenceSegmentSchema = z.object({
  start: z.string(),
  end: z.string(),
  duration: z.string(),
  description: z.string().min(1),
  source: z.enum(["AI Detection", "Context", "Human Rating"]),
  flag: z.enum(["Low", "Medium", "High"]).optional()
});

export const AiDetectionOutputSchema = z.object({
  skillCode: z.string().min(1),
  credit: CreditAssignmentSchema,
  confidence: z.number().min(0).max(1),
  evidenceSummary: z.string().min(1),
  timestamp: z.string().min(1),
  rationale: z.string().min(1),
  reviewFlags: z.array(z.string()).default([]),
  evidenceSegments: z.array(EvidenceSegmentSchema)
});

export const AiAssessmentOutputSchema = z.object({
  videoId: z.string().min(1),
  promptVersionId: z.string().min(1),
  detections: z.array(AiDetectionOutputSchema).min(1),
  dalSummary: z.object({
    totalSkills: z.number().int().nonnegative(),
    fullCredit: z.number().int().nonnegative(),
    partialCredit: z.number().int().nonnegative(),
    noCredit: z.number().int().nonnegative(),
    notObserved: z.number().int().nonnegative(),
    score: z.number().min(0).max(1)
  })
});

export const ReviewOverrideInputSchema = z.object({
  aiDetectionId: z.string().min(1),
  correctedCredit: CreditAssignmentSchema,
  reviewerNote: z.string().max(1000).optional()
});

export function validateRows<T>(rows: unknown[], schema: z.ZodType<T>) {
  const valid: T[] = [];
  const errors: Array<{ row: number; errors: string[] }> = [];

  rows.forEach((row, index) => {
    const parsed = schema.safeParse(row);
    if (parsed.success) {
      valid.push(parsed.data);
      return;
    }

    errors.push({
      row: index + 1,
      errors: parsed.error.issues.map((issue) => `${issue.path.join(".") || "row"}: ${issue.message}`)
    });
  });

  return { valid, errors };
}

export type RegisterVideoInput = z.infer<typeof RegisterVideoInputSchema>;
export type PromptVersionInput = z.infer<typeof PromptVersionInputSchema>;
export type ReviewOverrideInput = z.infer<typeof ReviewOverrideInputSchema>;
