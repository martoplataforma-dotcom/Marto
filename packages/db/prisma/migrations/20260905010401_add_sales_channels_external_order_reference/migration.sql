-- CreateEnum
CREATE TYPE "SalesChannelType" AS ENUM ('MARTO', 'MERCADO_LIVRE', 'SHOPEE', 'SITE', 'AMAZON', 'MAGALU', 'OTHER');

-- CreateEnum
CREATE TYPE "SalesChannelStatus" AS ENUM ('ACTIVE', 'DISCONNECTED', 'PAUSED', 'ERROR');

-- CreateTable
CREATE TABLE "SalesChannel" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "type" "SalesChannelType" NOT NULL,
    "name" TEXT NOT NULL,
    "externalAccountId" TEXT NOT NULL,
    "status" "SalesChannelStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesChannel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalOrderReference" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "salesChannelId" TEXT NOT NULL,
    "externalOrderId" TEXT NOT NULL,
    "externalStatus" TEXT,
    "externalCreatedAt" TIMESTAMP(3),
    "externalUpdatedAt" TIMESTAMP(3),
    "lastSyncedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalOrderReference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SalesChannel_merchantId_status_idx" ON "SalesChannel"("merchantId", "status");

-- CreateIndex
CREATE INDEX "SalesChannel_type_status_idx" ON "SalesChannel"("type", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SalesChannel_merchantId_type_externalAccountId_key" ON "SalesChannel"("merchantId", "type", "externalAccountId");

-- CreateIndex
CREATE INDEX "ExternalOrderReference_orderId_idx" ON "ExternalOrderReference"("orderId");

-- CreateIndex
CREATE INDEX "ExternalOrderReference_salesChannelId_lastSyncedAt_idx" ON "ExternalOrderReference"("salesChannelId", "lastSyncedAt");

-- CreateIndex
CREATE INDEX "ExternalOrderReference_externalStatus_idx" ON "ExternalOrderReference"("externalStatus");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalOrderReference_salesChannelId_externalOrderId_key" ON "ExternalOrderReference"("salesChannelId", "externalOrderId");

-- AddForeignKey
ALTER TABLE "SalesChannel" ADD CONSTRAINT "SalesChannel_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalOrderReference" ADD CONSTRAINT "ExternalOrderReference_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalOrderReference" ADD CONSTRAINT "ExternalOrderReference_salesChannelId_fkey" FOREIGN KEY ("salesChannelId") REFERENCES "SalesChannel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
