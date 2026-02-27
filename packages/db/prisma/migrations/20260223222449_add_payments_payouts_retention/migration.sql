-- CreateEnum
CREATE TYPE "PaymentContextType" AS ENUM ('order', 'service');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('authorized', 'captured', 'refunded', 'failed');

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('held', 'released', 'paid');

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "payerUserId" TEXT NOT NULL,
    "contextType" "PaymentContextType" NOT NULL,
    "contextId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'authorized',
    "pixChargeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payout" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "payeeUserId" TEXT NOT NULL,
    "contextType" "PaymentContextType" NOT NULL,
    "contextId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "status" "PayoutStatus" NOT NULL DEFAULT 'held',
    "releasedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payout_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Payment_pixChargeId_key" ON "Payment"("pixChargeId");

-- CreateIndex
CREATE INDEX "Payment_payerUserId_idx" ON "Payment"("payerUserId");

-- CreateIndex
CREATE INDEX "Payment_contextType_contextId_idx" ON "Payment"("contextType", "contextId");

-- CreateIndex
CREATE INDEX "Payout_paymentId_idx" ON "Payout"("paymentId");

-- CreateIndex
CREATE INDEX "Payout_payeeUserId_idx" ON "Payout"("payeeUserId");

-- CreateIndex
CREATE INDEX "Payout_contextType_contextId_idx" ON "Payout"("contextType", "contextId");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_payerUserId_fkey" FOREIGN KEY ("payerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_pixChargeId_fkey" FOREIGN KEY ("pixChargeId") REFERENCES "PixCharge"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_payeeUserId_fkey" FOREIGN KEY ("payeeUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
