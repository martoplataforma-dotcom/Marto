-- CreateEnum
CREATE TYPE "OrderEventType" AS ENUM ('STATUS_CHANGED', 'NOTE', 'FREIGHT_QUOTED', 'FREIGHT_SELECTED', 'PICKUP_REQUESTED', 'PICKUP_CONFIRMED', 'DELIVERED_CONFIRMED', 'RETURN_REQUESTED', 'RETURN_APPROVED', 'RETURN_REJECTED', 'DISPUTE_OPENED', 'DISPUTE_RESOLVED');

-- CreateTable
CREATE TABLE "OrderEvent" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "type" "OrderEventType" NOT NULL DEFAULT 'STATUS_CHANGED',
    "actorUserId" TEXT,
    "actorRole" TEXT,
    "fromStatus" "OrderStatus",
    "toStatus" "OrderStatus",
    "message" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrderEvent_orderId_createdAt_idx" ON "OrderEvent"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "OrderEvent_type_createdAt_idx" ON "OrderEvent"("type", "createdAt");

-- CreateIndex
CREATE INDEX "OrderEvent_toStatus_createdAt_idx" ON "OrderEvent"("toStatus", "createdAt");

-- AddForeignKey
ALTER TABLE "OrderEvent" ADD CONSTRAINT "OrderEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
