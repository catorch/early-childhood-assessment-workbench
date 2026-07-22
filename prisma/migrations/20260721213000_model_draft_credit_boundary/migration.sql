-- Keep AI draft credits inside the model-owned vocabulary. Existing educator
-- decisions are intentionally untouched because N/A and atypical remain valid
-- human choices.

UPDATE "SkillSuggestion"
SET
  "draftCredit" = NULL,
  "uncertaintyReason" = COALESCE(
    NULLIF(BTRIM("uncertaintyReason"), ''),
    'Requires educator judgment.'
  )
WHERE "draftCredit" IS NOT NULL
  AND "draftCredit" NOT IN (
    'PRESENT'::"PrimaryCredit",
    'EMERGING'::"PrimaryCredit",
    'NOT_OBSERVED'::"PrimaryCredit"
  );

ALTER TABLE "SkillSuggestion"
  ADD CONSTRAINT "SkillSuggestion_model_draft_credit_check"
  CHECK (
    "draftCredit" IS NULL
    OR "draftCredit" IN (
      'PRESENT'::"PrimaryCredit",
      'EMERGING'::"PrimaryCredit",
      'NOT_OBSERVED'::"PrimaryCredit"
    )
  );
