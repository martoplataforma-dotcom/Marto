-- CreateEnum
CREATE TYPE "PixChargeStatus" AS ENUM ('CREATED', 'WAITING_PAYMENT', 'PAID', 'EXPIRED', 'CANCELLED', 'FAILED');

-- CreateTable
CREATE TABLE "PixCharge" (
    "id" TEXT NOT NULL,
    "receiver" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "status" "PixChargeStatus" NOT NULL DEFAULT 'CREATED',
    "provider" TEXT,
    "providerId" TEXT,
    "brCode" TEXT,
    "qrCodeUrl" TEXT,
    "expiresAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PixCharge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PixCharge_reference_idx" ON "PixCharge"("reference");

-- CreateIndex
CREATE INDEX "PixCharge_status_idx" ON "PixCharge"("status");

-- CreateIndex
CREATE INDEX "PixCharge_provider_providerId_idx" ON "PixCharge"("provider", "providerId");

-- CreateIndex
CREATE INDEX "PixCharge_createdAt_idx" ON "PixCharge"("createdAt");
