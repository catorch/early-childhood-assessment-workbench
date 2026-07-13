-- Initial lean HELP Review pilot schema.
CREATE SCHEMA IF NOT EXISTS "public";

CREATE TYPE "Role" AS ENUM ('EDUCATOR', 'ADMIN');
CREATE TYPE "AssessmentStatus" AS ENUM ('DRAFT', 'UPLOADING', 'PROCESSING', 'READY_FOR_REVIEW', 'IN_REVIEW', 'FINALIZED', 'FAILED');
CREATE TYPE "VideoAssetStatus" AS ENUM ('PENDING_UPLOAD', 'AVAILABLE', 'REPLACED', 'DELETED');
CREATE TYPE "ProcessingRunStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED');
CREATE TYPE "PrimaryCredit" AS ENUM ('PRESENT', 'EMERGING', 'NOT_OBSERVED', 'NOT_APPLICABLE');
CREATE TYPE "DecisionOrigin" AS ENUM ('ACCEPTED', 'OVERRIDDEN', 'SCORED_INDEPENDENTLY', 'DISMISSED');

CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "externalSubject" TEXT NOT NULL,
    "email" TEXT,
    "displayName" TEXT,
    "role" "Role" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AccessProvision" (
    "id" TEXT NOT NULL,
    "externalSubject" TEXT,
    "exactEmail" TEXT,
    "intendedRole" "Role" NOT NULL,
    "providerEnrollmentRef" TEXT,
    "provisionedById" TEXT NOT NULL,
    "activatedAt" TIMESTAMP(3),
    "deactivatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AccessProvision_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AccessProvision_identity_check" CHECK ("externalSubject" IS NOT NULL OR "exactEmail" IS NOT NULL)
);

CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3),
    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Child" (
    "id" TEXT NOT NULL,
    "externalChildId" TEXT NOT NULL,
    "ageMonths" INTEGER NOT NULL,
    "approvedContext" JSONB,
    "processingAllowed" BOOLEAN,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Child_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Child_ageMonths_check" CHECK ("ageMonths" BETWEEN 0 AND 216)
);

CREATE TABLE "ChildAssignment" (
    "id" TEXT NOT NULL,
    "educatorId" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ChildAssignment_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ChildAssignment_window_check" CHECK ("endsAt" IS NULL OR "endsAt" >= "startsAt")
);

CREATE TABLE "Assessment" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "educatorId" TEXT NOT NULL,
    "observationDate" TIMESTAMP(3) NOT NULL,
    "contextSnapshot" JSONB,
    "status" "AssessmentStatus" NOT NULL DEFAULT 'DRAFT',
    "finalizedById" TEXT,
    "finalizedAt" TIMESTAMP(3),
    "revision" INTEGER NOT NULL DEFAULT 0,
    "clientRequestId" TEXT,
    "finalizationKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Assessment_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Assessment_revision_check" CHECK ("revision" >= 0),
    CONSTRAINT "Assessment_finalization_check" CHECK (
      ("status" = 'FINALIZED' AND "finalizedAt" IS NOT NULL AND "finalizedById" IS NOT NULL)
      OR
      ("status" <> 'FINALIZED' AND "finalizedAt" IS NULL AND "finalizedById" IS NULL)
    )
);

CREATE TABLE "VideoAsset" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "status" "VideoAssetStatus" NOT NULL DEFAULT 'PENDING_UPLOAD',
    "storageKey" TEXT NOT NULL,
    "originalFilename" TEXT,
    "contentType" TEXT,
    "byteSize" BIGINT,
    "durationSeconds" INTEGER,
    "checksumSha256" TEXT,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "VideoAsset_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "VideoAsset_size_check" CHECK ("byteSize" IS NULL OR "byteSize" > 0),
    CONSTRAINT "VideoAsset_duration_check" CHECK ("durationSeconds" IS NULL OR "durationSeconds" > 0)
);

CREATE TABLE "VideoAccessGrantRecord" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "videoAssetId" TEXT NOT NULL,
    "viewerId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "VideoAccessGrantRecord_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "VideoAccessGrantRecord_expiry_check" CHECK ("expiresAt" > "issuedAt")
);

CREATE TABLE "ProcessingRun" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "attempt" INTEGER NOT NULL,
    "status" "ProcessingRunStatus" NOT NULL DEFAULT 'QUEUED',
    "externalJobId" TEXT,
    "scoringConfigurationReference" TEXT,
    "safeErrorCode" TEXT,
    "retryOfRunId" TEXT,
    "requestedById" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProcessingRun_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ProcessingRun_attempt_check" CHECK ("attempt" > 0),
    CONSTRAINT "ProcessingRun_completion_check" CHECK (
      ("status" IN ('COMPLETED', 'FAILED') AND "completedAt" IS NOT NULL)
      OR
      ("status" IN ('QUEUED', 'RUNNING') AND "completedAt" IS NULL)
    )
);

CREATE TABLE "SkillSuggestion" (
    "id" TEXT NOT NULL,
    "processingRunId" TEXT NOT NULL,
    "sourceSkillId" TEXT NOT NULL,
    "skillCode" TEXT NOT NULL,
    "skillName" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "strand" TEXT,
    "draftCredit" "PrimaryCredit",
    "confidence" DOUBLE PRECISION,
    "uncertaintyReason" TEXT,
    "evidence" JSONB NOT NULL,
    "rationale" TEXT,
    "sourceOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SkillSuggestion_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "SkillSuggestion_confidence_check" CHECK ("confidence" IS NULL OR "confidence" BETWEEN 0 AND 1),
    CONSTRAINT "SkillSuggestion_uncertainty_check" CHECK ("draftCredit" IS NOT NULL OR "uncertaintyReason" IS NOT NULL),
    CONSTRAINT "SkillSuggestion_sourceOrder_check" CHECK ("sourceOrder" >= 0)
);

CREATE TABLE "ReviewDecision" (
    "id" TEXT NOT NULL,
    "suggestionId" TEXT NOT NULL,
    "educatorId" TEXT NOT NULL,
    "origin" "DecisionOrigin" NOT NULL,
    "finalCredit" "PrimaryCredit",
    "dismissed" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ReviewDecision_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ReviewDecision_revision_check" CHECK ("revision" > 0),
    CONSTRAINT "ReviewDecision_credit_check" CHECK (
      ("dismissed" = true AND "finalCredit" IS NULL AND "origin" = 'DISMISSED')
      OR
      ("dismissed" = false AND "finalCredit" IS NOT NULL AND "origin" <> 'DISMISSED')
    )
);

CREATE UNIQUE INDEX "User_externalSubject_key" ON "User"("externalSubject");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "AccessProvision_externalSubject_key" ON "AccessProvision"("externalSubject");
CREATE INDEX "AccessProvision_exactEmail_deactivatedAt_idx" ON "AccessProvision"("exactEmail", "deactivatedAt");
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");
CREATE INDEX "Session_userId_expiresAt_idx" ON "Session"("userId", "expiresAt");
CREATE UNIQUE INDEX "Child_externalChildId_key" ON "Child"("externalChildId");
CREATE INDEX "ChildAssignment_educatorId_startsAt_endsAt_revokedAt_idx" ON "ChildAssignment"("educatorId", "startsAt", "endsAt", "revokedAt");
CREATE INDEX "ChildAssignment_childId_startsAt_endsAt_revokedAt_idx" ON "ChildAssignment"("childId", "startsAt", "endsAt", "revokedAt");
CREATE UNIQUE INDEX "Assessment_finalizationKey_key" ON "Assessment"("finalizationKey");
CREATE INDEX "Assessment_educatorId_status_updatedAt_idx" ON "Assessment"("educatorId", "status", "updatedAt");
CREATE INDEX "Assessment_childId_observationDate_idx" ON "Assessment"("childId", "observationDate");
CREATE UNIQUE INDEX "Assessment_educatorId_clientRequestId_key" ON "Assessment"("educatorId", "clientRequestId");
CREATE UNIQUE INDEX "VideoAsset_storageKey_key" ON "VideoAsset"("storageKey");
CREATE INDEX "VideoAsset_assessmentId_status_idx" ON "VideoAsset"("assessmentId", "status");
CREATE INDEX "VideoAccessGrantRecord_assessmentId_viewerId_issuedAt_idx" ON "VideoAccessGrantRecord"("assessmentId", "viewerId", "issuedAt");
CREATE INDEX "VideoAccessGrantRecord_videoAssetId_expiresAt_idx" ON "VideoAccessGrantRecord"("videoAssetId", "expiresAt");
CREATE UNIQUE INDEX "ProcessingRun_externalJobId_key" ON "ProcessingRun"("externalJobId");
CREATE INDEX "ProcessingRun_assessmentId_status_idx" ON "ProcessingRun"("assessmentId", "status");
CREATE UNIQUE INDEX "ProcessingRun_assessmentId_attempt_key" ON "ProcessingRun"("assessmentId", "attempt");
CREATE UNIQUE INDEX "SkillSuggestion_processingRunId_sourceSkillId_key" ON "SkillSuggestion"("processingRunId", "sourceSkillId");
CREATE UNIQUE INDEX "SkillSuggestion_processingRunId_sourceOrder_key" ON "SkillSuggestion"("processingRunId", "sourceOrder");
CREATE UNIQUE INDEX "ReviewDecision_suggestionId_key" ON "ReviewDecision"("suggestionId");
CREATE INDEX "ReviewDecision_educatorId_decidedAt_idx" ON "ReviewDecision"("educatorId", "decidedAt");

ALTER TABLE "AccessProvision" ADD CONSTRAINT "AccessProvision_provisionedById_fkey" FOREIGN KEY ("provisionedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChildAssignment" ADD CONSTRAINT "ChildAssignment_educatorId_fkey" FOREIGN KEY ("educatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ChildAssignment" ADD CONSTRAINT "ChildAssignment_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ChildAssignment" ADD CONSTRAINT "ChildAssignment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_educatorId_fkey" FOREIGN KEY ("educatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_finalizedById_fkey" FOREIGN KEY ("finalizedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VideoAsset" ADD CONSTRAINT "VideoAsset_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VideoAsset" ADD CONSTRAINT "VideoAsset_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VideoAccessGrantRecord" ADD CONSTRAINT "VideoAccessGrantRecord_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VideoAccessGrantRecord" ADD CONSTRAINT "VideoAccessGrantRecord_videoAssetId_fkey" FOREIGN KEY ("videoAssetId") REFERENCES "VideoAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VideoAccessGrantRecord" ADD CONSTRAINT "VideoAccessGrantRecord_viewerId_fkey" FOREIGN KEY ("viewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProcessingRun" ADD CONSTRAINT "ProcessingRun_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProcessingRun" ADD CONSTRAINT "ProcessingRun_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProcessingRun" ADD CONSTRAINT "ProcessingRun_retryOfRunId_fkey" FOREIGN KEY ("retryOfRunId") REFERENCES "ProcessingRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SkillSuggestion" ADD CONSTRAINT "SkillSuggestion_processingRunId_fkey" FOREIGN KEY ("processingRunId") REFERENCES "ProcessingRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReviewDecision" ADD CONSTRAINT "ReviewDecision_suggestionId_fkey" FOREIGN KEY ("suggestionId") REFERENCES "SkillSuggestion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReviewDecision" ADD CONSTRAINT "ReviewDecision_educatorId_fkey" FOREIGN KEY ("educatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
