ALTER TABLE "VideoAsset"
  ADD COLUMN "storageProvider" TEXT NOT NULL DEFAULT 'local',
  ADD COLUMN "storageBucket" TEXT,
  ADD COLUMN "storageGeneration" TEXT,
  ADD COLUMN "checksumCrc32c" TEXT;

UPDATE "VideoAsset"
SET "storageProvider" = 'vercel-blob'
WHERE "storageKey" LIKE 'help-review/%';

ALTER TABLE "ProcessingRun"
  ADD COLUMN "triggerEventId" TEXT,
  ADD COLUMN "triggerObjectGeneration" TEXT,
  ADD COLUMN "deliveryCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lastDispatchedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "ProcessingRun_triggerEventId_key" ON "ProcessingRun"("triggerEventId");

ALTER TABLE "ProcessingRun"
  ADD CONSTRAINT "ProcessingRun_deliveryCount_check" CHECK ("deliveryCount" >= 0);
