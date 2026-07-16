-- First-party email/password identity: salted password hashes plus single-use invite/reset tokens.

-- AlterEnum
ALTER TYPE "SupportEventType" ADD VALUE 'CREDENTIAL_CHANGED';

-- CreateTable
CREATE TABLE "StaffCredential" (
    "userId" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffCredential_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "StaffAuthToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),

    CONSTRAINT "StaffAuthToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StaffAuthToken_tokenHash_key" ON "StaffAuthToken"("tokenHash");

-- CreateIndex
CREATE INDEX "StaffAuthToken_userId_purpose_usedAt_idx" ON "StaffAuthToken"("userId", "purpose", "usedAt");

-- AddForeignKey
ALTER TABLE "StaffCredential" ADD CONSTRAINT "StaffCredential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffAuthToken" ADD CONSTRAINT "StaffAuthToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
