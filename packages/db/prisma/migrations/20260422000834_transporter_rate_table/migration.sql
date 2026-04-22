-- CreateEnum
CREATE TYPE "ShippingClass" AS ENUM ('SMALL', 'MEDIUM', 'LARGE', 'BULKY');

-- CreateTable
CREATE TABLE "TransporterRateTable" (
    "id" TEXT NOT NULL,
    "transporterId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "originCepStart" TEXT NOT NULL,
    "originCepEnd" TEXT NOT NULL,
    "destinationCepStart" TEXT NOT NULL,
    "destinationCepEnd" TEXT NOT NULL,
    "shippingClass" "ShippingClass" NOT NULL,
    "weightMinKg" DECIMAL(10,3) NOT NULL,
    "weightMaxKg" DECIMAL(10,3) NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "daysMin" INTEGER NOT NULL,
    "daysMax" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransporterRateTable_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TransporterRateTable_transporterId_active_idx" ON "TransporterRateTable"("transporterId", "active");

-- CreateIndex
CREATE INDEX "TransporterRateTable_originCepStart_originCepEnd_idx" ON "TransporterRateTable"("originCepStart", "originCepEnd");

-- CreateIndex
CREATE INDEX "TransporterRateTable_destinationCepStart_destinationCepEnd_idx" ON "TransporterRateTable"("destinationCepStart", "destinationCepEnd");

-- CreateIndex
CREATE INDEX "TransporterRateTable_shippingClass_idx" ON "TransporterRateTable"("shippingClass");

-- AddForeignKey
ALTER TABLE "TransporterRateTable" ADD CONSTRAINT "TransporterRateTable_transporterId_fkey" FOREIGN KEY ("transporterId") REFERENCES "Transporter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
