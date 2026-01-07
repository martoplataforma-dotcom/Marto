-- CreateEnum
CREATE TYPE "AnticipationStatus" AS ENUM ('REQUESTED', 'APPROVED', 'PAID', 'CANCELLED', 'FAILED');

-- CreateTable
CREATE TABLE "Anticipation" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "orderId" TEXT,
    "amount" DECIMAL(14,2) NOT NULL,
    "fee" DECIMAL(14,2) NOT NULL,
    "netAmount" DECIMAL(14,2) NOT NULL,
    "status" "AnticipationStatus" NOT NULL DEFAULT 'REQUESTED',
    "reason" TEXT,
    "reference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Anticipation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Anticipation_merchantId_createdAt_idx" ON "Anticipation"("merchantId", "createdAt");

-- CreateIndex
CREATE INDEX "Anticipation_orderId_idx" ON "Anticipation"("orderId");

-- CreateIndex
CREATE INDEX "Anticipation_status_idx" ON "Anticipation"("status");
