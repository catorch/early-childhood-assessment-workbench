-- Educator-added review skills: new decision origin and suggestion source marker.

-- AlterEnum
ALTER TYPE "DecisionOrigin" ADD VALUE 'MANUALLY_ADDED';

-- AlterTable
ALTER TABLE "SkillSuggestion" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'MODEL';
