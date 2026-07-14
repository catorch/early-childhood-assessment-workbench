CREATE TYPE "SupportEventType" AS ENUM (
    'VIDEO_ACCESSED',
    'DECISION_SAVED',
    'PROCESSING_RETRIED',
    'ACCESS_CHANGED',
    'ASSIGNMENT_CHANGED',
    'ASSESSMENT_FINALIZED'
);

CREATE TABLE "SupportEvent" (
    "id" TEXT NOT NULL,
    "type" "SupportEventType" NOT NULL,
    "actorId" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assessmentId" TEXT,
    "subjectId" TEXT,
    "referenceId" TEXT,
    CONSTRAINT "SupportEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SupportEvent_actorId_occurredAt_idx" ON "SupportEvent"("actorId", "occurredAt");
CREATE INDEX "SupportEvent_assessmentId_occurredAt_idx" ON "SupportEvent"("assessmentId", "occurredAt");
