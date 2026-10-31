-- CreateEnum
CREATE TYPE "SalesChannelCredentialStatus" AS ENUM ('ACTIVE', 'REFRESHING', 'TRANSIENT_ERROR', 'ROTATION_UNCERTAIN', 'REAUTH_REQUIRED');

-- CreateTable
CREATE TABLE "SalesChannelCredential" (
    "id" TEXT NOT NULL,
    "salesChannelId" TEXT NOT NULL,
    "status" "SalesChannelCredentialStatus" NOT NULL DEFAULT 'ACTIVE',
    "accessTokenEncrypted" TEXT NOT NULL,
    "refreshTokenEncrypted" TEXT NOT NULL,
    "encryptionKeyVersion" TEXT NOT NULL,
    "tokenType" TEXT,
    "scope" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3) NOT NULL,
    "authorizedExternalAccountId" TEXT NOT NULL,
    "tokenGeneration" INTEGER NOT NULL DEFAULT 1,
    "refreshAttemptId" TEXT,
    "refreshStartedAt" TIMESTAMP(3),
    "lastRotatedAt" TIMESTAMP(3),
    "lastErrorCode" TEXT,
    "lastErrorAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesChannelCredential_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SalesChannelCredential_salesChannelId_key" ON "SalesChannelCredential"("salesChannelId");

-- CreateIndex
CREATE INDEX "SalesChannelCredential_status_idx" ON "SalesChannelCredential"("status");

-- CreateIndex
CREATE INDEX "SalesChannelCredential_accessTokenExpiresAt_idx" ON "SalesChannelCredential"("accessTokenExpiresAt");

-- AddForeignKey
ALTER TABLE "SalesChannelCredential" ADD CONSTRAINT "SalesChannelCredential_salesChannelId_fkey" FOREIGN KEY ("salesChannelId") REFERENCES "SalesChannel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
