-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "reservedUntil" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Order_reservedUntil_idx" ON "Order"("reservedUntil");
