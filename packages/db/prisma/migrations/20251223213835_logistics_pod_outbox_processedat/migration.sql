-- CreateEnum
CREATE TYPE "PodType" AS ENUM ('CODE', 'PHOTO', 'SIGNATURE');

-- AlterTable
ALTER TABLE "OutboxEvent" ADD COLUMN     "processedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "DeliveryProof" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "type" "PodType" NOT NULL,
    "code" TEXT,
    "photoUrl" TEXT,
    "signedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeliveryProof_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DeliveryProof_shipmentId_idx" ON "DeliveryProof"("shipmentId");

-- AddForeignKey
ALTER TABLE "DeliveryProof" ADD CONSTRAINT "DeliveryProof_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
