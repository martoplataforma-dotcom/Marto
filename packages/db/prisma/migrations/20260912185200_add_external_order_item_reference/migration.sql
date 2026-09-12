-- CreateTable
CREATE TABLE "ExternalOrderItemReference" (
    "id" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "externalOrderReferenceId" TEXT NOT NULL,
    "externalItemId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalOrderItemReference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExternalOrderItemReference_orderItemId_idx" ON "ExternalOrderItemReference"("orderItemId");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalOrderItemReference_externalOrderReferenceId_externa_key" ON "ExternalOrderItemReference"("externalOrderReferenceId", "externalItemId");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalOrderItemReference_externalOrderReferenceId_orderIt_key" ON "ExternalOrderItemReference"("externalOrderReferenceId", "orderItemId");

-- AddForeignKey
ALTER TABLE "ExternalOrderItemReference" ADD CONSTRAINT "ExternalOrderItemReference_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalOrderItemReference" ADD CONSTRAINT "ExternalOrderItemReference_externalOrderReferenceId_fkey" FOREIGN KEY ("externalOrderReferenceId") REFERENCES "ExternalOrderReference"("id") ON DELETE CASCADE ON UPDATE CASCADE;
