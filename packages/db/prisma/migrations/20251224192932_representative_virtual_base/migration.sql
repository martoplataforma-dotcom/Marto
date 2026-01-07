-- CreateEnum
CREATE TYPE "PurchaseIntentStatus" AS ENUM ('OPEN', 'NEGOTIATING', 'CONVERTED', 'LOST', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RelationshipStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'CLOSED');

-- CreateTable
CREATE TABLE "FactoryChannel" (
    "id" TEXT NOT NULL,
    "factoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "catalogInfo" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FactoryChannel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseIntent" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "productInfo" JSONB NOT NULL,
    "quantity" INTEGER,
    "frequency" TEXT,
    "notes" TEXT,
    "status" "PurchaseIntentStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseIntent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RelationshipHistory" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "purchaseIntentId" TEXT,
    "summary" TEXT,
    "internalNotes" TEXT,
    "status" "RelationshipStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RelationshipHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FactoryChannel_factoryId_key" ON "FactoryChannel"("factoryId");

-- CreateIndex
CREATE INDEX "FactoryChannel_factoryId_idx" ON "FactoryChannel"("factoryId");

-- CreateIndex
CREATE INDEX "PurchaseIntent_channelId_idx" ON "PurchaseIntent"("channelId");

-- CreateIndex
CREATE INDEX "PurchaseIntent_status_idx" ON "PurchaseIntent"("status");

-- CreateIndex
CREATE UNIQUE INDEX "RelationshipHistory_purchaseIntentId_key" ON "RelationshipHistory"("purchaseIntentId");

-- CreateIndex
CREATE INDEX "RelationshipHistory_channelId_idx" ON "RelationshipHistory"("channelId");

-- CreateIndex
CREATE INDEX "RelationshipHistory_status_idx" ON "RelationshipHistory"("status");

-- AddForeignKey
ALTER TABLE "PurchaseIntent" ADD CONSTRAINT "PurchaseIntent_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "FactoryChannel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RelationshipHistory" ADD CONSTRAINT "RelationshipHistory_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "FactoryChannel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RelationshipHistory" ADD CONSTRAINT "RelationshipHistory_purchaseIntentId_fkey" FOREIGN KEY ("purchaseIntentId") REFERENCES "PurchaseIntent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
