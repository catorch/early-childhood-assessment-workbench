-- Shared fixed-window budgets for scaled web instances. Identity values are one-way hashes.
CREATE TABLE "RateLimitBucket" (
    "scope" VARCHAR(100) NOT NULL,
    "identityHash" VARCHAR(64) NOT NULL,
    "count" INTEGER NOT NULL,
    "resetAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimitBucket_pkey" PRIMARY KEY ("scope", "identityHash"),
    CONSTRAINT "RateLimitBucket_count_check" CHECK ("count" > 0)
);

CREATE INDEX "RateLimitBucket_resetAt_idx" ON "RateLimitBucket"("resetAt");
