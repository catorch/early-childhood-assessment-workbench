-- Intentional blank, educator-only atypical credit, and the additive O concern flag.

ALTER TYPE "PrimaryCredit" ADD VALUE 'BLANK';
ALTER TYPE "PrimaryCredit" ADD VALUE 'ATYPICAL';
ALTER TYPE "PrimaryCredit" ADD VALUE 'ATYPICAL_PLUS';
ALTER TYPE "PrimaryCredit" ADD VALUE 'ATYPICAL_MINUS';
ALTER TYPE "PrimaryCredit" ADD VALUE 'ATYPICAL_EMERGING';

ALTER TABLE "ReviewDecision"
  ADD COLUMN "concernFlag" BOOLEAN NOT NULL DEFAULT false;
