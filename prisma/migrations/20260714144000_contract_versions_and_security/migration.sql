ALTER TABLE "Assessment"
  ADD COLUMN "contentCatalogVersion" TEXT NOT NULL DEFAULT 'help-2-provisional-2026-07',
  ADD COLUMN "scoringContractVersion" TEXT NOT NULL DEFAULT 'help-scoring-v0';

ALTER TABLE "Assessment"
  ADD CONSTRAINT "Assessment_content_versions_nonempty_check"
  CHECK (length("contentCatalogVersion") > 0 AND length("scoringContractVersion") > 0);
