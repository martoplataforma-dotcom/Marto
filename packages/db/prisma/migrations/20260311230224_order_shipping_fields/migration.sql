-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "destinationZipCode" TEXT,
ADD COLUMN     "estimatedDays" INTEGER,
ADD COLUMN     "originZipCodeSnapshot" TEXT,
ADD COLUMN     "selectedShippingMode" TEXT,
ADD COLUMN     "shippingPriceCents" INTEGER;
